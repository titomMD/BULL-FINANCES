-- BULLMILTON · Pagos de tarjeta y presupuestos personales (pedido del usuario, 2026-10-13)
--
-- Tarjeta: un gasto marcado paid_with_card no baja el saldo disponible al registrarse; la parte
-- de cada uno queda "por pagar de tarjeta" (cálculo en el frontend, src/lib/calculations/
-- available.ts). Un pago de tarjeta (card_payments) es lo que una persona abona de su parte:
-- baja su saldo disponible y lo que tiene por pagar. Mismo esquema que transfers (inserción
-- directa con GRANT por columna, auditoría, anulación).
--
-- Presupuestos: privados de cada persona (solo quien los crea los ve). Tres tipos: por categoría,
-- tope total o libre con nombre; por mes o por semana. A un presupuesto libre se le asignan
-- gastos a mano (budget_expenses, también privado).

-- ---------------------------------------------------------------------------
-- Pagos de tarjeta
-- ---------------------------------------------------------------------------
create table public.card_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null,
  amount bigint not null check (amount between 1 and 100000000000000),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  date date not null default private.today_bogota()
    check (date between '2000-01-01' and '2100-12-31'),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  check ((status = 'voided') = (voided_at is not null))
);

comment on table public.card_payments is
  'Abono de una persona a su parte de lo cargado a la tarjeta. Baja su saldo disponible.';

create index card_payments_household_date_idx on public.card_payments (household_id, date desc);
create index card_payments_user_idx on public.card_payments (household_id, user_id);

alter table public.card_payments enable row level security;

create trigger card_payments_audit before insert or update on public.card_payments
  for each row execute function private.set_audit_fields();
create trigger card_payments_household_immutable before update on public.card_payments
  for each row execute function private.prevent_household_change();
create trigger card_payments_active_members before insert or update on public.card_payments
  for each row execute function private.require_active_members('user_id');
create trigger card_payments_voidable before insert or update on public.card_payments
  for each row execute function private.guard_voidable();

create policy "card_payments: ver los de mi household" on public.card_payments
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "card_payments: crear en mi household" on public.card_payments
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "card_payments: editar los de mi household" on public.card_payments
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));

-- ---------------------------------------------------------------------------
-- Presupuestos personales
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('category', 'total', 'free')),
  category_id uuid,
  amount bigint not null check (amount between 1 and 100000000000000),
  period text not null check (period in ('month', 'week')),
  created_at timestamptz not null default now(),
  unique (id, household_id, user_id),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  -- Sin cascade: una categoría con presupuestos no se puede borrar (se archiva).
  foreign key (category_id, household_id) references public.categories (id, household_id),
  check ((kind = 'category') = (category_id is not null))
);

comment on table public.budgets is
  'Presupuesto personal y privado: por categoría, tope total o libre; por mes o por semana.';

create index budgets_owner_idx on public.budgets (household_id, user_id);
create index budgets_category_idx on public.budgets (category_id, household_id)
  where category_id is not null;

alter table public.budgets enable row level security;

create trigger budgets_household_immutable before update on public.budgets
  for each row execute function private.prevent_household_change();
create trigger budgets_category_kind before insert or update of category_id on public.budgets
  for each row execute function private.require_category_kind('expense');

create policy "budgets: ver los míos" on public.budgets
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "budgets: crear los míos" on public.budgets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "budgets: editar los míos" on public.budgets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "budgets: borrar los míos" on public.budgets
  for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.budget_expenses (
  budget_id uuid not null,
  expense_id uuid not null,
  household_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (budget_id, expense_id),
  foreign key (budget_id, household_id, user_id)
    references public.budgets (id, household_id, user_id) on delete cascade,
  foreign key (expense_id, household_id)
    references public.expenses (id, household_id) on delete cascade
);

comment on table public.budget_expenses is
  'Gastos que una persona cuenta en uno de sus presupuestos libres (privado).';

create index budget_expenses_expense_idx on public.budget_expenses (expense_id);
create index budget_expenses_owner_idx on public.budget_expenses (household_id, user_id);

alter table public.budget_expenses enable row level security;

create policy "budget_expenses: ver los míos" on public.budget_expenses
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "budget_expenses: crear los míos" on public.budget_expenses
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "budget_expenses: borrar los míos" on public.budget_expenses
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reemplaza en qué presupuestos libres de quien llama cuenta un gasto (en una transacción).
-- SECURITY INVOKER: RLS decide qué gasto y qué presupuestos puede ver y tocar.
create function public.set_expense_budgets(p_expense_id uuid, p_budget_ids jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;
  if p_budget_ids is null or jsonb_typeof(p_budget_ids) <> 'array' then
    raise exception using message = 'invalid_budget', errcode = '23514';
  end if;
  if jsonb_array_length(p_budget_ids) > 10 then
    raise exception using message = 'invalid_budget', errcode = '23514';
  end if;

  select e.household_id into v_household_id from public.expenses e where e.id = p_expense_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_budget_ids) as wanted (id)
    where not exists (
      select 1 from public.budgets b
      where b.id = wanted.id::uuid
        and b.user_id = auth.uid()
        and b.household_id = v_household_id
        and b.kind = 'free'
    )
  ) then
    raise exception using message = 'invalid_budget', errcode = '23514';
  end if;

  delete from public.budget_expenses
  where expense_id = p_expense_id and user_id = auth.uid();

  insert into public.budget_expenses (budget_id, expense_id, household_id, user_id)
  select distinct wanted.id::uuid, p_expense_id, v_household_id, auth.uid()
  from jsonb_array_elements_text(p_budget_ids) as wanted (id);
end;
$$;

comment on function public.set_expense_budgets(uuid, jsonb) is
  'Reemplaza los presupuestos libres (de quien llama) en los que cuenta un gasto.';

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant select on public.card_payments to authenticated;
grant insert (household_id, user_id, amount, currency, date, notes)
  on public.card_payments to authenticated;
grant update (user_id, amount, date, notes, status) on public.card_payments to authenticated;

grant select, delete on public.budgets to authenticated;
grant insert (household_id, user_id, name, kind, category_id, amount, period)
  on public.budgets to authenticated;
grant update (name, kind, category_id, amount, period) on public.budgets to authenticated;

grant select, insert, delete on public.budget_expenses to authenticated;

grant execute on function public.set_expense_budgets(uuid, jsonb) to authenticated;
