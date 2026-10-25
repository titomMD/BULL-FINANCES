-- BULLMILTON · Varias categorías por gasto y "pagado con tarjeta" (pedido del usuario, 2026-10-12)
--
-- Categorías: expenses.category_id sigue siendo la principal (la primera elegida; la usan los
-- recurrentes y el icono del movimiento). Las demás van en expense_categories. En los reportes
-- el gasto cuenta completo en cada una de sus categorías.
-- Tarjeta: un marcador booleano en gastos y recurrentes (el gasto generado lo hereda).
-- create_expense / update_expense / create_recurring_expense / update_recurring_expense ganan
-- parámetros opcionales al final: las llamadas existentes siguen funcionando igual.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.expense_categories (
  expense_id uuid not null,
  household_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (expense_id, category_id),
  foreign key (expense_id, household_id)
    references public.expenses (id, household_id) on delete cascade,
  -- Sin cascade: una categoría con gastos no se puede borrar (se archiva).
  foreign key (category_id, household_id) references public.categories (id, household_id)
);

comment on table public.expense_categories is
  'Categorías adicionales de un gasto (la principal está en expenses.category_id).';

create index expense_categories_household_idx on public.expense_categories (household_id);
create index expense_categories_category_idx on public.expense_categories (category_id);

alter table public.expense_categories enable row level security;

alter table public.expenses add column paid_with_card boolean not null default false;
alter table public.recurring_expenses add column paid_with_card boolean not null default false;

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------
create trigger expense_categories_category_kind before insert on public.expense_categories
  for each row execute function private.require_category_kind('expense');
create trigger expense_categories_parent_active before insert or delete on public.expense_categories
  for each row execute function private.guard_split_parent_active();

create policy "expense_categories: ver las de mi household" on public.expense_categories
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "expense_categories: crear en mi household" on public.expense_categories
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "expense_categories: borrar las de mi household" on public.expense_categories
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

-- Reemplaza las categorías adicionales de un gasto (sin repetir ni duplicar la principal).
create function private.set_expense_categories(
  p_expense_id uuid,
  p_household_id uuid,
  p_primary uuid,
  p_extra jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_extra is not null and jsonb_typeof(p_extra) <> 'array' then
    raise exception using message = 'invalid_category', errcode = '23514';
  end if;
  if jsonb_array_length(coalesce(p_extra, '[]'::jsonb)) > 5 then
    raise exception using message = 'too_many_categories', errcode = '23514';
  end if;

  delete from public.expense_categories where expense_id = p_expense_id;

  insert into public.expense_categories (expense_id, household_id, category_id)
  select distinct p_expense_id, p_household_id, (value #>> '{}')::uuid
  from jsonb_array_elements(coalesce(p_extra, '[]'::jsonb))
  where (value #>> '{}')::uuid is distinct from p_primary;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------------
drop function public.create_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text);
drop function public.update_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text);

create function public.create_expense(
  p_household_id uuid,
  p_description text,
  p_amount bigint,
  p_category_id uuid,
  p_paid_by uuid,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_date date default null,
  p_notes text default null,
  p_extra_category_ids jsonb default '[]'::jsonb,
  p_paid_with_card boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_shares jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  v_shares := private.build_shares(p_household_id, p_split_type, p_participants);

  insert into public.expenses (
    household_id, description, amount, currency, date, category_id, paid_by, split_type, notes,
    paid_with_card
  )
  values (
    p_household_id,
    btrim(p_description),
    p_amount,
    coalesce((select h.currency from public.households h where h.id = p_household_id), 'COP'),
    coalesce(p_date, private.today_bogota()),
    p_category_id,
    p_paid_by,
    p_split_type,
    nullif(btrim(p_notes), ''),
    coalesce(p_paid_with_card, false)
  )
  returning id into v_expense_id;

  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  select v_expense_id, p_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;

  perform private.set_expense_categories(
    v_expense_id, p_household_id, p_category_id, p_extra_category_ids
  );

  return v_expense_id;
end;
$$;

comment on function public.create_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text, jsonb, boolean) is
  'Crea un gasto, sus splits y sus categorías adicionales en una sola transacción.';

create function public.update_expense(
  p_expense_id uuid,
  p_description text,
  p_amount bigint,
  p_category_id uuid,
  p_paid_by uuid,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_date date default null,
  p_notes text default null,
  p_extra_category_ids jsonb default '[]'::jsonb,
  p_paid_with_card boolean default false
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

  -- RLS: si el gasto no es de mi household, no lo veo y no existe para mí.
  select e.household_id into v_household_id from public.expenses e where e.id = p_expense_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;

  v_shares := private.build_shares(v_household_id, p_split_type, p_participants);

  update public.expenses
  set
    description = btrim(p_description),
    amount = p_amount,
    date = coalesce(p_date, date),
    category_id = p_category_id,
    paid_by = p_paid_by,
    split_type = p_split_type,
    notes = nullif(btrim(p_notes), ''),
    paid_with_card = coalesce(p_paid_with_card, false)
  where id = p_expense_id;

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  select p_expense_id, v_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;

  perform private.set_expense_categories(
    p_expense_id, v_household_id, p_category_id, p_extra_category_ids
  );
end;
$$;

comment on function public.update_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text, jsonb, boolean) is
  'Edita un gasto activo y reemplaza sus splits y categorías adicionales en una sola transacción.';

-- ---------------------------------------------------------------------------
-- Recurrentes: el marcador de tarjeta se guarda en la plantilla y pasa al gasto generado.
-- ---------------------------------------------------------------------------
drop function public.create_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text);
drop function public.update_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text, boolean);

create function public.create_recurring_expense(
  p_household_id uuid,
  p_name text,
  p_amount bigint,
  p_frequency text,
  p_next_due_date date,
  p_category_id uuid,
  p_paid_by uuid,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_notes text default null,
  p_paid_with_card boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_shares jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  v_shares := private.build_shares(p_household_id, p_split_type, p_participants);

  insert into public.recurring_expenses (
    household_id, name, amount, currency, frequency, next_due_date, anchor_day,
    category_id, paid_by, split_type, notes, paid_with_card
  )
  values (
    p_household_id,
    btrim(p_name),
    p_amount,
    coalesce((select h.currency from public.households h where h.id = p_household_id), 'COP'),
    p_frequency,
    p_next_due_date,
    extract(day from p_next_due_date)::smallint,
    p_category_id,
    p_paid_by,
    p_split_type,
    nullif(btrim(p_notes), ''),
    coalesce(p_paid_with_card, false)
  )
  returning id into v_id;

  insert into public.recurring_expense_splits (recurring_expense_id, household_id, user_id, share_bp)
  select v_id, p_household_id, (e ->> 'user_id')::uuid, (e ->> 'share_bp')::integer
  from jsonb_array_elements(v_shares) as e;

  return v_id;
end;
$$;

create function public.update_recurring_expense(
  p_recurring_expense_id uuid,
  p_name text,
  p_amount bigint,
  p_frequency text,
  p_next_due_date date,
  p_category_id uuid,
  p_paid_by uuid,
  p_split_type text default 'equal',
  p_participants jsonb default null,
  p_notes text default null,
  p_active boolean default true,
  p_paid_with_card boolean default false
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

  select r.household_id into v_household_id
  from public.recurring_expenses r
  where r.id = p_recurring_expense_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;

  v_shares := private.build_shares(v_household_id, p_split_type, p_participants);

  update public.recurring_expenses
  set
    name = btrim(p_name),
    amount = p_amount,
    frequency = p_frequency,
    next_due_date = p_next_due_date,
    anchor_day = extract(day from p_next_due_date)::smallint,
    category_id = p_category_id,
    paid_by = p_paid_by,
    split_type = p_split_type,
    notes = nullif(btrim(p_notes), ''),
    active = p_active,
    paid_with_card = coalesce(p_paid_with_card, false)
  where id = p_recurring_expense_id;

  delete from public.recurring_expense_splits where recurring_expense_id = p_recurring_expense_id;

  insert into public.recurring_expense_splits (recurring_expense_id, household_id, user_id, share_bp)
  select p_recurring_expense_id, v_household_id, (e ->> 'user_id')::uuid, (e ->> 'share_bp')::integer
  from jsonb_array_elements(v_shares) as e;
end;
$$;

-- Misma firma: solo cambia que el gasto generado hereda paid_with_card.
create or replace function public.generate_recurring_expense(
  p_recurring_expense_id uuid,
  p_amount bigint default null,
  p_date date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.recurring_expenses%rowtype;
  v_shares jsonb;
  v_amount bigint;
  v_expense_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  -- FOR UPDATE: dos confirmaciones simultáneas no generan dos gastos.
  select * into v_template
  from public.recurring_expenses
  where id = p_recurring_expense_id
  for update;

  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;
  if not v_template.active then
    raise exception using message = 'recurring_inactive', errcode = 'P0001';
  end if;
  if v_template.next_due_date > private.today_bogota() then
    raise exception using message = 'recurring_not_due', errcode = 'P0001';
  end if;

  select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'share_bp', s.share_bp))
  into v_shares
  from public.recurring_expense_splits s
  where s.recurring_expense_id = p_recurring_expense_id;

  v_amount := coalesce(p_amount, v_template.amount);

  insert into public.expenses (
    household_id, description, amount, currency, date, category_id, paid_by, split_type,
    notes, recurring_expense_id, recurring_due_date, paid_with_card
  )
  values (
    v_template.household_id,
    v_template.name,
    v_amount,
    v_template.currency,
    coalesce(p_date, v_template.next_due_date),
    v_template.category_id,
    v_template.paid_by,
    v_template.split_type,
    v_template.notes,
    v_template.id,
    v_template.next_due_date,
    v_template.paid_with_card
  )
  returning id into v_expense_id;

  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  select v_expense_id, v_template.household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(v_amount, v_shares) as a;

  update public.recurring_expenses
  set next_due_date = private.next_occurrence(
    v_template.next_due_date, v_template.frequency, v_template.anchor_day
  )
  where id = p_recurring_expense_id;

  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant select, insert, delete on public.expense_categories to authenticated;
grant insert (paid_with_card), update (paid_with_card) on public.expenses to authenticated;
grant insert (paid_with_card), update (paid_with_card) on public.recurring_expenses to authenticated;

grant execute on function private.set_expense_categories(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text, jsonb, boolean) to authenticated;
grant execute on function public.update_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text, jsonb, boolean) to authenticated;
grant execute on function public.create_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text, boolean) to authenticated;
grant execute on function public.update_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text, boolean, boolean) to authenticated;
grant execute on function public.generate_recurring_expense(uuid, bigint, date) to authenticated;
