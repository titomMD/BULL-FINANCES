-- BULLMILTON · Registro abierto + Plan del mes (Mi finanzas, 2026-10-25)
--
-- 1) Registro abierto. Esta versión es personal: cualquiera puede crear su cuenta (con email o con
--    Google). El código de invitación sigue existiendo para compartir un hogar, pero ya no es
--    obligatorio: el hook solo rechaza un código que viene escrito y no es válido.
--
-- 2) plan_items: el plan mensual de cada persona (ingresos, gastos fijos y ahorro). Es privado
--    (RLS por user_id, como personal_movements) y no entra en los cálculos del hogar. El mes se
--    calcula en el frontend (src/lib/calculations/plan.ts).

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(event -> 'user' -> 'user_metadata' ->> 'invite_code', '')));
begin
  -- Sin código (registro normal o Google): se puede crear la cuenta.
  if v_code = '' then
    return '{}'::jsonb;
  end if;

  if v_code ~ '^[A-HJ-NP-Z2-9]{10}$' and exists (
    select 1
    from public.invitations i
    where i.code = v_code
      and i.used_at is null
      and i.expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;

  -- Un código escrito que no sirve ("no existe", "usado", "vencido") se rechaza con un único mensaje.
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'invalid_invitation')
  );
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Hook de Supabase Auth (Before User Created): deja crear cuentas; si traen código de invitación, debe ser vigente.';

-- Con Google el nombre llega en full_name / name (no en display_name): se usa como nombre del perfil.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      ),
      60
    )
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plan del mes
-- ---------------------------------------------------------------------------
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('income', 'expense', 'saving')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Para agrupar gastos que se pagan juntos (p. ej. "Tarjeta"). Solo se muestra; no cambia cuentas.
  group_name text check (group_name is null or char_length(btrim(group_name)) between 1 and 60),
  amount bigint not null check (amount between 1 and 100000000000000),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  -- Primer y último mes en que cuenta (se usa el mes de la fecha). Null = sin límite.
  -- Ej.: la cuota del fondo semestral va de julio a diciembre.
  starts_on date check (starts_on is null or starts_on between '2000-01-01' and '2100-12-31'),
  ends_on date check (ends_on is null or ends_on between '2000-01-01' and '2100-12-31'),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

comment on table public.plan_items is
  'Plan mensual personal: ingresos, gastos fijos y ahorro de una persona. Privado; no cuenta en el hogar.';

create index plan_items_owner_idx on public.plan_items (household_id, user_id, kind, sort_order);

alter table public.plan_items enable row level security;

create trigger plan_items_audit before insert or update on public.plan_items
  for each row execute function private.set_audit_fields();
create trigger plan_items_household_immutable before update on public.plan_items
  for each row execute function private.prevent_household_change();

create policy "plan_items: ver los míos" on public.plan_items
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "plan_items: crear los míos" on public.plan_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "plan_items: editar los míos" on public.plan_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Es configuración, no libro contable: se puede borrar una línea del plan.
create policy "plan_items: borrar los míos" on public.plan_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

grant select, delete on public.plan_items to authenticated;
grant insert (household_id, kind, name, group_name, amount, currency, starts_on, ends_on, sort_order)
  on public.plan_items to authenticated;
grant update (name, group_name, amount, starts_on, ends_on, sort_order)
  on public.plan_items to authenticated;
