-- BULLMILTON · Ingresos compartidos y apariencia por cuenta (pedido del usuario, 2026-10-12)
--
-- 1. Un ingreso puede repartirse entre varios miembros (partes iguales o porcentajes) igual que
--    un gasto. El reparto SOLO cuenta para reportes: los ingresos siguen sin generar deuda (§6).
--    incomes.user_id pasa a significar "quién lo recibió"; income_splits dice de quién es.
-- 2. Cualquier miembro del household puede registrar y editar ingresos de cualquier miembro
--    (antes solo el dueño). Las escrituras pasan por RPC atómicas: ingreso + splits.
-- 3. profiles.theme / profiles.font: preferencias de apariencia, sincronizadas entre dispositivos.

-- ---------------------------------------------------------------------------
-- Ingresos: tipo de reparto y splits
-- ---------------------------------------------------------------------------
alter table public.incomes
  add column split_type text not null default 'equal' check (split_type in ('equal', 'percentage'));

comment on column public.incomes.user_id is 'Quién recibió el dinero. De quién es lo dice income_splits.';

alter table public.incomes add constraint incomes_id_household_key unique (id, household_id);

create table public.income_splits (
  id uuid primary key default gen_random_uuid(),
  income_id uuid not null,
  household_id uuid not null,
  user_id uuid not null,
  share_bp integer not null check (share_bp between 0 and 10000),
  amount bigint not null check (amount >= 0),
  unique (income_id, user_id),
  foreign key (income_id, household_id)
    references public.incomes (id, household_id) on delete cascade,
  foreign key (household_id, user_id) references public.household_members (household_id, user_id)
);

comment on table public.income_splits is
  'De quién es cada ingreso (solo reportes; no afecta el saldo entre miembros).';

create index income_splits_income_idx on public.income_splits (income_id, household_id);
create index income_splits_user_idx on public.income_splits (household_id, user_id);

alter table public.income_splits enable row level security;

-- Los ingresos que ya existían son 100 % de quien los recibió.
insert into public.income_splits (income_id, household_id, user_id, share_bp, amount)
select i.id, i.household_id, i.user_id, 10000, i.amount
from public.incomes i;

-- ---------------------------------------------------------------------------
-- Consistencia y guardas (mismo patrón que expense_splits)
-- ---------------------------------------------------------------------------
create function private.assert_income_splits_consistent(p_income_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_shares jsonb;
  v_total_bp bigint;
begin
  select i.amount into v_amount from public.incomes i where i.id = p_income_id;
  if not found then
    return;
  end if;

  select
    jsonb_agg(jsonb_build_object('user_id', s.user_id, 'share_bp', s.share_bp)),
    coalesce(sum(s.share_bp), 0)
  into v_shares, v_total_bp
  from public.income_splits s
  where s.income_id = p_income_id;

  if v_total_bp <> 10000 or exists (
    select 1
    from (select s.user_id, s.amount from public.income_splits s where s.income_id = p_income_id) actual
    full join private.allocate_split_amounts(v_amount, v_shares) expected using (user_id)
    where actual.amount is distinct from expected.amount
  ) then
    raise exception using
      message = 'invalid_income_splits',
      errcode = '23514',
      detail = format('income %s: los splits no suman 100 %% o no cuadran con el monto', p_income_id);
  end if;
end;
$$;

create function private.check_splits_on_income()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_income_splits_consistent(new.id);
  return null;
end;
$$;

create function private.check_splits_on_income_split()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_income_splits_consistent(old.income_id);
  else
    perform private.assert_income_splits_consistent(new.income_id);
  end if;
  return null;
end;
$$;

-- Los splits de un ingreso anulado son de solo lectura.
create function private.guard_income_split_parent_active()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_income_id uuid;
begin
  v_income_id := case when tg_op = 'DELETE' then old.income_id else new.income_id end;
  if exists (select 1 from public.incomes i where i.id = v_income_id and i.status = 'voided') then
    raise exception using message = 'record_voided', errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger income_splits_active_members before insert on public.income_splits
  for each row execute function private.require_active_members('user_id');
create trigger income_splits_parent_active before insert or delete on public.income_splits
  for each row execute function private.guard_income_split_parent_active();

create constraint trigger incomes_splits_consistent
  after insert or update of amount on public.incomes
  deferrable initially deferred
  for each row execute function private.check_splits_on_income();
create constraint trigger income_splits_consistent
  after insert or update or delete on public.income_splits
  deferrable initially deferred
  for each row execute function private.check_splits_on_income_split();

-- ---------------------------------------------------------------------------
-- Políticas: cualquier miembro activo registra y edita ingresos de su household
-- ---------------------------------------------------------------------------
drop policy "incomes: crear los míos" on public.incomes;
drop policy "incomes: editar los míos" on public.incomes;

create policy "incomes: crear en mi household" on public.incomes
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "incomes: editar los de mi household" on public.incomes
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));

create policy "income_splits: ver los de mi household" on public.income_splits
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "income_splits: crear en mi household" on public.income_splits
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "income_splits: borrar los de mi household" on public.income_splits
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

-- ---------------------------------------------------------------------------
-- RPC atómicas para ingresos. SECURITY INVOKER: RLS aplica igual que en escritura directa.
-- p_split_type / p_participants: mismo formato que create_expense. Un ingreso de una sola
-- persona es 'equal' con un único participante.
-- ---------------------------------------------------------------------------
create function public.create_income(
  p_household_id uuid,
  p_user_id uuid,
  p_source text,
  p_amount bigint,
  p_category_id uuid default null,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_income_id uuid;
  v_shares jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  v_shares := private.build_shares(
    p_household_id,
    p_split_type,
    coalesce(p_participants, jsonb_build_array(coalesce(p_user_id, auth.uid())))
  );

  insert into public.incomes (
    household_id, user_id, source, amount, currency, date, category_id, split_type, notes
  )
  values (
    p_household_id,
    coalesce(p_user_id, auth.uid()),
    btrim(p_source),
    p_amount,
    coalesce((select h.currency from public.households h where h.id = p_household_id), 'COP'),
    coalesce(p_date, private.today_bogota()),
    p_category_id,
    p_split_type,
    nullif(btrim(p_notes), '')
  )
  returning id into v_income_id;

  insert into public.income_splits (income_id, household_id, user_id, share_bp, amount)
  select v_income_id, p_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;

  return v_income_id;
end;
$$;

comment on function public.create_income(uuid, uuid, text, bigint, uuid, text, jsonb, date, text) is
  'Crea un ingreso y su reparto en una transacción. p_user_id = quién lo recibió (por defecto, '
  'quien llama). Sin p_participants el ingreso es 100 % de quien lo recibió.';

create function public.update_income(
  p_income_id uuid,
  p_user_id uuid,
  p_source text,
  p_amount bigint,
  p_category_id uuid default null,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_date date default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_shares jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  select i.household_id into v_household_id from public.incomes i where i.id = p_income_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;

  v_shares := private.build_shares(
    v_household_id,
    p_split_type,
    coalesce(p_participants, jsonb_build_array(p_user_id))
  );

  update public.incomes
  set
    user_id = p_user_id,
    source = btrim(p_source),
    amount = p_amount,
    date = coalesce(p_date, date),
    category_id = p_category_id,
    split_type = p_split_type,
    notes = nullif(btrim(p_notes), '')
  where id = p_income_id;

  delete from public.income_splits where income_id = p_income_id;

  insert into public.income_splits (income_id, household_id, user_id, share_bp, amount)
  select p_income_id, v_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;
end;
$$;

comment on function public.update_income(uuid, uuid, text, bigint, uuid, text, jsonb, date, text) is
  'Edita un ingreso activo y reemplaza su reparto en una sola transacción.';

create function public.void_income(p_income_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  update public.incomes set status = 'voided' where id = p_income_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;
end;
$$;

comment on function public.void_income(uuid) is 'Anula un ingreso (no se borra).';

-- ---------------------------------------------------------------------------
-- Apariencia por cuenta. Los valores válidos son los temas y fuentes de src/lib/appearance.ts.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column theme text not null default 'bullmilton'
    check (theme in ('bullmilton', 'grafito', 'oceano', 'vino', 'papel', 'salvia')),
  add column font text not null default 'system'
    check (font in ('system', 'geist', 'manrope', 'plex', 'atkinson'));

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant insert (split_type) on public.incomes to authenticated;
grant update (user_id, split_type) on public.incomes to authenticated;
grant select, insert, delete on public.income_splits to authenticated;
grant update (theme, font) on public.profiles to authenticated;

grant execute on function private.assert_income_splits_consistent(uuid) to authenticated;
grant execute on function public.create_income(uuid, uuid, text, bigint, uuid, text, jsonb, date, text) to authenticated;
grant execute on function public.update_income(uuid, uuid, text, bigint, uuid, text, jsonb, date, text) to authenticated;
grant execute on function public.void_income(uuid) to authenticated;
