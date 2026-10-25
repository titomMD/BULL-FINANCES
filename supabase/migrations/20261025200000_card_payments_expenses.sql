-- Freyapp · Tarjetas v5 (pedido del usuario, 2026-10-25)
--
-- 1) Extractos con dos cuentas separadas: pesos (COP) y dólares (USD, en centavos), más la
--    cuota de manejo y la tasa mensual del extracto.
-- 2) debt_payments: cada pago hecho a una tarjeta (mínimo o abono), en pesos o en dólares.
--    Un trigger mantiene paid_amount / usd_paid del extracto = suma de sus pagos.
-- 3) debt_card_expenses: gastos hechos con la tarjeta (los del próximo extracto), en pesos o dólares.
-- 4) plan_checks.paid_amount: lo realmente pagado de una línea (p. ej. cuota de manejo 17.250 vs 18.000).
-- 5) debt_accounts.fee_plan_item_id: línea del plan (Membresías) donde se descuenta la cuota de manejo.
--
-- Pesos: enteros en COP. Dólares: enteros en centavos. Tasa de cambio: pesos por dólar × 100.
-- Todo privado (RLS por user_id).

-- ---------------------------------------------------------------------------
-- 1) Extractos en dos monedas
-- ---------------------------------------------------------------------------
alter table public.debt_statements
  add column usd_total_due bigint not null default 0 check (usd_total_due between 0 and 100000000000),
  add column usd_minimum_due bigint not null default 0 check (usd_minimum_due between 0 and 100000000000),
  add column usd_paid bigint not null default 0 check (usd_paid between 0 and 100000000000),
  -- Cuota de manejo cobrada en este extracto (COP).
  add column fee_amount bigint check (fee_amount is null or fee_amount between 0 and 100000000000),
  -- Tasa de interés mensual vencida en millonésimas: 2,1593 % = 21593.
  add column monthly_rate_ppm int check (monthly_rate_ppm is null or monthly_rate_ppm between 0 and 1000000);

-- ---------------------------------------------------------------------------
-- 5) Línea del plan donde se descuenta la cuota de manejo
-- ---------------------------------------------------------------------------
alter table public.debt_accounts
  add column fee_plan_item_id uuid references public.plan_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) Lo realmente pagado de una línea marcada
-- ---------------------------------------------------------------------------
alter table public.plan_checks
  add column paid_amount bigint check (paid_amount is null or paid_amount between 0 and 100000000000000);

-- ---------------------------------------------------------------------------
-- 2) Pagos a tarjetas
-- ---------------------------------------------------------------------------
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  account_id uuid not null,
  statement_id uuid references public.debt_statements (id) on delete cascade,
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  -- Pesos enteros (COP) o centavos (USD).
  amount bigint not null check (amount between 1 and 100000000000000),
  kind text not null default 'extra' check (kind in ('minimum', 'extra', 'full')),
  paid_on date not null default private.today_bogota()
    check (paid_on between '2000-01-01' and '2100-12-31'),
  -- Pesos por dólar × 100 (solo pagos en USD): para saber cuánto costó en pesos.
  fx_rate_cents bigint check (fx_rate_cents is null or fx_rate_cents between 1 and 100000000),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  foreign key (account_id, user_id) references public.debt_accounts (id, user_id) on delete cascade
);

comment on table public.debt_payments is
  'Pagos a una tarjeta/deuda, en pesos o dólares, cada moneda por separado. Privado.';

create index debt_payments_owner_idx on public.debt_payments (household_id, user_id, account_id, paid_on desc);
create index debt_payments_statement_idx on public.debt_payments (statement_id);

-- ---------------------------------------------------------------------------
-- 3) Gastos hechos con la tarjeta (los que saldrán en el próximo extracto)
-- ---------------------------------------------------------------------------
create table public.debt_card_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  account_id uuid not null,
  expense_date date not null default private.today_bogota()
    check (expense_date between '2000-01-01' and '2100-12-31'),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  -- Pesos enteros (COP) o centavos (USD).
  amount bigint not null check (amount between 1 and 100000000000000),
  fx_rate_cents bigint check (fx_rate_cents is null or fx_rate_cents between 1 and 100000000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  foreign key (account_id, user_id) references public.debt_accounts (id, user_id) on delete cascade
);

comment on table public.debt_card_expenses is
  'Gastos con tarjeta aún sin extracto, en pesos o dólares. Privado.';

create index debt_card_expenses_owner_idx
  on public.debt_card_expenses (household_id, user_id, account_id, expense_date desc);

-- ---------------------------------------------------------------------------
-- Trigger: el extracto refleja la suma de sus pagos (database-first)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: el trigger escribe columnas que la persona no puede editar a mano
-- (paid_amount, usd_paid, paid_on); solo toca extractos del dueño del pago.
create function private.sync_statement_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.statement_id is not null then
    v_ids := v_ids || old.statement_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.statement_id is not null then
    v_ids := v_ids || new.statement_id;
  end if;

  foreach v_id in array v_ids loop
    update public.debt_statements s
       set paid_amount = coalesce((select sum(p.amount) from public.debt_payments p
                                   where p.statement_id = v_id and p.currency = 'COP'), 0),
           usd_paid = coalesce((select sum(p.amount) from public.debt_payments p
                                where p.statement_id = v_id and p.currency = 'USD'), 0),
           paid_on = (select max(p.paid_on) from public.debt_payments p where p.statement_id = v_id)
     where s.id = v_id and s.user_id = coalesce(new.user_id, old.user_id);
  end loop;
  return null;
end
$$;

create trigger debt_payments_sync_statement
  after insert or update or delete on public.debt_payments
  for each row execute function private.sync_statement_paid();

-- ---------------------------------------------------------------------------
-- Auditoría, RLS
-- ---------------------------------------------------------------------------
create trigger debt_payments_audit before insert or update on public.debt_payments
  for each row execute function private.set_audit_fields();
create trigger debt_card_expenses_audit before insert or update on public.debt_card_expenses
  for each row execute function private.set_audit_fields();
create trigger debt_payments_household_immutable before update on public.debt_payments
  for each row execute function private.prevent_household_change();
create trigger debt_card_expenses_household_immutable before update on public.debt_card_expenses
  for each row execute function private.prevent_household_change();

alter table public.debt_payments enable row level security;
alter table public.debt_card_expenses enable row level security;

create policy "debt_payments: ver los míos" on public.debt_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "debt_payments: crear los míos" on public.debt_payments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
    and (statement_id is null or exists (
      select 1 from public.debt_statements s
      where s.id = statement_id and s.user_id = (select auth.uid()) and s.account_id = debt_payments.account_id
    ))
  );
create policy "debt_payments: editar los míos" on public.debt_payments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "debt_payments: borrar los míos" on public.debt_payments
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "debt_card_expenses: ver los míos" on public.debt_card_expenses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "debt_card_expenses: crear los míos" on public.debt_card_expenses
  for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id in (select private.current_household_ids()));
create policy "debt_card_expenses: editar los míos" on public.debt_card_expenses
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "debt_card_expenses: borrar los míos" on public.debt_card_expenses
  for delete to authenticated using (user_id = (select auth.uid()));

-- La línea de cuota de manejo debe ser del mismo dueño de la tarjeta.
create function private.check_fee_plan_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fee_plan_item_id is not null and not exists (
    select 1 from public.plan_items p where p.id = new.fee_plan_item_id and p.user_id = new.user_id
  ) then
    raise exception 'fee_plan_item_invalid' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger debt_accounts_fee_item before insert or update on public.debt_accounts
  for each row execute function private.check_fee_plan_item();

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant insert (paid_amount) on public.plan_checks to authenticated;
grant update (paid_amount) on public.plan_checks to authenticated;

grant insert (fee_plan_item_id) on public.debt_accounts to authenticated;
grant update (fee_plan_item_id) on public.debt_accounts to authenticated;

grant insert (usd_total_due, usd_minimum_due, fee_amount, monthly_rate_ppm)
  on public.debt_statements to authenticated;
grant update (usd_total_due, usd_minimum_due, fee_amount, monthly_rate_ppm)
  on public.debt_statements to authenticated;
-- paid_amount, usd_paid y paid_on los mantiene el trigger a partir de los pagos.

grant select, delete on public.debt_payments to authenticated;
grant insert (household_id, account_id, statement_id, currency, amount, kind, paid_on, fx_rate_cents, note)
  on public.debt_payments to authenticated;
grant update (currency, amount, kind, paid_on, fx_rate_cents, note) on public.debt_payments to authenticated;

grant select, delete on public.debt_card_expenses to authenticated;
grant insert (household_id, account_id, expense_date, description, currency, amount, fx_rate_cents)
  on public.debt_card_expenses to authenticated;
grant update (expense_date, description, currency, amount, fx_rate_cents)
  on public.debt_card_expenses to authenticated;
