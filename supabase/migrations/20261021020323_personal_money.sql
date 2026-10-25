-- BULLMILTON · Dinero personal (pedido del usuario, 2026-10-20)
--
-- Cada persona puede llevar aparte su dinero personal: ingresos que son solo suyos y gastos que
-- paga con ese dinero. Es privado (solo quien lo registra lo ve, como los presupuestos) y no
-- entra en el saldo disponible, en "lo que queda" ni en los reportes del hogar: vive en su propia
-- tabla y ningún cálculo del hogar la lee. El saldo personal se calcula en el frontend
-- (src/lib/calculations/personal.ts).

create table public.personal_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('income', 'expense')),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount bigint not null check (amount between 1 and 100000000000000),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  date date not null default private.today_bogota()
    check (date between '2000-01-01' and '2100-12-31'),
  category_id uuid,
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  -- Sin cascade: una categoría en uso no se puede borrar (se archiva).
  foreign key (category_id, household_id) references public.categories (id, household_id),
  check ((status = 'voided') = (voided_at is not null))
);

comment on table public.personal_movements is
  'Ingresos y gastos del dinero personal de una persona. Privado; no cuenta en el hogar.';

create index personal_movements_owner_idx
  on public.personal_movements (household_id, user_id, date desc);
create index personal_movements_category_idx on public.personal_movements (category_id, household_id)
  where category_id is not null;

alter table public.personal_movements enable row level security;

-- La categoría, si hay, debe ser del mismo tipo que el movimiento (ingreso/gasto).
-- SECURITY DEFINER por la misma razón que private.require_category_kind: solo compara el tipo;
-- el household lo exigen la FK compuesta y RLS.
create function private.require_personal_category_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.kind = new.kind
  ) then
    raise exception using message = 'invalid_category', errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger personal_movements_audit before insert or update on public.personal_movements
  for each row execute function private.set_audit_fields();
create trigger personal_movements_household_immutable before update on public.personal_movements
  for each row execute function private.prevent_household_change();
create trigger personal_movements_voidable before insert or update on public.personal_movements
  for each row execute function private.guard_voidable();
create trigger personal_movements_category_kind
  before insert or update of category_id on public.personal_movements
  for each row execute function private.require_personal_category_kind();

create policy "personal_movements: ver los míos" on public.personal_movements
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "personal_movements: crear los míos" on public.personal_movements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "personal_movements: editar los míos" on public.personal_movements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant select on public.personal_movements to authenticated;
grant insert (household_id, kind, description, amount, currency, date, category_id, notes)
  on public.personal_movements to authenticated;
grant update (description, amount, date, category_id, notes, status)
  on public.personal_movements to authenticated;
