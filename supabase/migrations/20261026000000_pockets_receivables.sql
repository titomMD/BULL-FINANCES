-- Freyapp · Bolsillos y cuenta con mamá (pedido del usuario, 2026-10-25)
--
-- 1) pockets / pocket_moves: espejo de los bolsillos de Bancolombia. El saldo de un bolsillo es la
--    suma de sus movimientos (depósitos, retiros, ajustes, traslados y préstamos entre bolsillos).
--    `goal` es la meta (lo que debería tener). `covers_receivable` marca el bolsillo cuyo faltante
--    corresponde a lo que mamá le debe a la persona (p. ej. «1ER SEMESTRE 2027»).
-- 2) move_between_pockets(): traslado o préstamo entre dos bolsillos, atómico (dos movimientos
--    enlazados por link_id); si se borra uno, se borra su pareja.
-- 3) receivable_entries / receivable_rules: libreta «mamá me debe» (cobros y pagos) y cobros que se
--    repiten (semanales o mensuales). La app los registra sola; cada uno es editable y borrable.
--
-- Dinero en pesos enteros (COP). Todo privado (RLS por user_id).

-- ---------------------------------------------------------------------------
-- 1) Bolsillos
-- ---------------------------------------------------------------------------
create table public.pockets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  goal bigint check (goal is null or goal between 0 and 100000000000000),
  covers_receivable boolean not null default false,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  unique (id, user_id)
);

comment on table public.pockets is 'Bolsillos (espejo de Bancolombia). Privado.';

create index pockets_owner_idx on public.pockets (household_id, user_id, sort_order);

create table public.pocket_moves (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  pocket_id uuid not null,
  -- Con signo: positivo entra al bolsillo, negativo sale.
  amount bigint not null check (amount <> 0 and amount between -100000000000000 and 100000000000000),
  kind text not null check (kind in (
    'deposit', 'withdraw', 'adjust', 'transfer', 'loan_out', 'loan_in', 'loan_back', 'loan_return'
  )),
  move_date date not null default private.today_bogota()
    check (move_date between '2000-01-01' and '2100-12-31'),
  note text check (note is null or char_length(note) <= 200),
  -- Une las dos mitades de un traslado o préstamo entre bolsillos.
  link_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  foreign key (pocket_id, user_id) references public.pockets (id, user_id) on delete cascade,
  constraint pocket_moves_sign check (
    case kind
      when 'deposit' then amount > 0
      when 'loan_in' then amount > 0
      when 'loan_back' then amount > 0
      when 'withdraw' then amount < 0
      when 'loan_out' then amount < 0
      when 'loan_return' then amount < 0
      else true
    end
  )
);

comment on table public.pocket_moves is
  'Movimientos de un bolsillo, con signo. El saldo es la suma. Privado.';

create index pocket_moves_owner_idx
  on public.pocket_moves (household_id, user_id, pocket_id, move_date desc);
create index pocket_moves_link_idx on public.pocket_moves (link_id) where link_id is not null;

-- Al borrar una mitad de un traslado o préstamo, se borra la otra.
create function private.delete_linked_pocket_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.link_id is not null then
    delete from public.pocket_moves where link_id = old.link_id and id <> old.id;
  end if;
  return old;
end
$$;

create trigger pocket_moves_linked_delete after delete on public.pocket_moves
  for each row execute function private.delete_linked_pocket_move();

-- ---------------------------------------------------------------------------
-- 3) Cuenta con mamá
-- ---------------------------------------------------------------------------
create table public.receivable_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  amount bigint not null check (amount between 1 and 100000000000000),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  starts_on date not null check (starts_on between '2000-01-01' and '2100-12-31'),
  ends_on date check (ends_on is null or ends_on between '2000-01-01' and '2100-12-31'),
  active boolean not null default true,
  -- Hasta qué día ya se registraron sus cobros: lo que borres a mano no vuelve a aparecer.
  generated_until date check (generated_until is null or generated_until between '2000-01-01' and '2100-12-31'),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  unique (id, user_id),
  check (ends_on is null or ends_on >= starts_on)
);

comment on table public.receivable_rules is 'Cobros que se repiten a mamá. Privado.';

create table public.receivable_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  -- 'charge' = mamá te debe más; 'payment' = mamá te pagó.
  kind text not null check (kind in ('charge', 'payment')),
  amount bigint not null check (amount between 1 and 100000000000000),
  entry_date date not null default private.today_bogota()
    check (entry_date between '2000-01-01' and '2100-12-31'),
  note text check (note is null or char_length(note) <= 200),
  rule_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  foreign key (rule_id, user_id) references public.receivable_rules (id, user_id) on delete set null,
  -- Un cobro automático por regla y día (permite registrar «solo los que faltan» sin duplicar).
  unique (rule_id, entry_date)
);

comment on table public.receivable_entries is 'Cobros y pagos de la cuenta con mamá. Privado.';

create index receivable_entries_owner_idx
  on public.receivable_entries (household_id, user_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Auditoría, RLS
-- ---------------------------------------------------------------------------
create trigger pockets_audit before insert or update on public.pockets
  for each row execute function private.set_audit_fields();
create trigger pocket_moves_audit before insert or update on public.pocket_moves
  for each row execute function private.set_audit_fields();
create trigger receivable_rules_audit before insert or update on public.receivable_rules
  for each row execute function private.set_audit_fields();
create trigger receivable_entries_audit before insert or update on public.receivable_entries
  for each row execute function private.set_audit_fields();

create trigger pockets_household_immutable before update on public.pockets
  for each row execute function private.prevent_household_change();
create trigger pocket_moves_household_immutable before update on public.pocket_moves
  for each row execute function private.prevent_household_change();
create trigger receivable_rules_household_immutable before update on public.receivable_rules
  for each row execute function private.prevent_household_change();
create trigger receivable_entries_household_immutable before update on public.receivable_entries
  for each row execute function private.prevent_household_change();

alter table public.pockets enable row level security;
alter table public.pocket_moves enable row level security;
alter table public.receivable_rules enable row level security;
alter table public.receivable_entries enable row level security;

create policy "pockets: ver los míos" on public.pockets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "pockets: crear los míos" on public.pockets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id in (select private.current_household_ids()));
create policy "pockets: editar los míos" on public.pockets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "pockets: borrar los míos" on public.pockets
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "pocket_moves: ver los míos" on public.pocket_moves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "pocket_moves: crear los míos" on public.pocket_moves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id in (select private.current_household_ids()));
create policy "pocket_moves: editar los míos" on public.pocket_moves
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "pocket_moves: borrar los míos" on public.pocket_moves
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "receivable_rules: ver las mías" on public.receivable_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy "receivable_rules: crear las mías" on public.receivable_rules
  for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id in (select private.current_household_ids()));
create policy "receivable_rules: editar las mías" on public.receivable_rules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "receivable_rules: borrar las mías" on public.receivable_rules
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "receivable_entries: ver los míos" on public.receivable_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "receivable_entries: crear los míos" on public.receivable_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id in (select private.current_household_ids()));
create policy "receivable_entries: editar los míos" on public.receivable_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "receivable_entries: borrar los míos" on public.receivable_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Traslado o préstamo entre bolsillos (atómico)
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: corre con los permisos y la RLS de quien la llama, así que solo toca
-- bolsillos propios.
--   p_kind 'transfer'  : de p_from a p_to, sin deuda.
--   p_kind 'loan'      : p_from presta a p_to (p_from queda con «prestado» pendiente).
--   p_kind 'loan_back' : p_from (el que debía) devuelve a p_to (el que prestó).
create function public.move_between_pockets(
  p_from uuid,
  p_to uuid,
  p_amount bigint,
  p_kind text default 'transfer',
  p_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_household uuid;
  v_to_household uuid;
  v_link uuid := gen_random_uuid();
  v_date date := coalesce(p_date, private.today_bogota());
  v_out text;
  v_in text;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'pockets_invalid' using errcode = '22023';
  end if;
  if p_kind not in ('transfer', 'loan', 'loan_back') then
    raise exception 'kind_invalid' using errcode = '22023';
  end if;

  select household_id into v_household from public.pockets where id = p_from;
  select household_id into v_to_household from public.pockets where id = p_to;
  if v_household is null or v_to_household is null or v_household <> v_to_household then
    raise exception 'pockets_invalid' using errcode = '22023';
  end if;

  v_out := case p_kind when 'transfer' then 'transfer' when 'loan' then 'loan_out' else 'loan_return' end;
  v_in := case p_kind when 'transfer' then 'transfer' when 'loan' then 'loan_in' else 'loan_back' end;

  insert into public.pocket_moves (household_id, pocket_id, amount, kind, move_date, note, link_id)
  values
    (v_household, p_from, -p_amount, v_out, v_date, p_note, v_link),
    (v_household, p_to, p_amount, v_in, v_date, p_note, v_link);

  return v_link;
end
$$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;
grant execute on function public.move_between_pockets(uuid, uuid, bigint, text, date, text) to authenticated;

grant select, delete on public.pockets to authenticated;
grant insert (household_id, name, goal, covers_receivable, sort_order) on public.pockets to authenticated;
grant update (name, goal, covers_receivable, sort_order, archived_at) on public.pockets to authenticated;

grant select, delete on public.pocket_moves to authenticated;
grant insert (household_id, pocket_id, amount, kind, move_date, note, link_id)
  on public.pocket_moves to authenticated;
-- Un movimiento enlazado no cambia de valor (se borra y se rehace); solo fecha y nota.
grant update (move_date, note) on public.pocket_moves to authenticated;

grant select, delete on public.receivable_rules to authenticated;
grant insert (household_id, label, amount, frequency, starts_on, ends_on, active, generated_until)
  on public.receivable_rules to authenticated;
grant update (label, amount, frequency, starts_on, ends_on, active, generated_until)
  on public.receivable_rules to authenticated;

grant select, delete on public.receivable_entries to authenticated;
grant insert (household_id, kind, amount, entry_date, note, rule_id)
  on public.receivable_entries to authenticated;
grant update (kind, amount, entry_date, note) on public.receivable_entries to authenticated;
