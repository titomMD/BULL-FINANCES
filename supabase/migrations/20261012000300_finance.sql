-- =============================================================================
-- BULLMILTON · 03 · Categorías, gastos, splits, ingresos, transferencias y recurrentes
--
-- Integridad en la base de datos (spec §31, Regla 6):
--   * FKs compuestas (x_id, household_id): una categoría, un pagador o un split no pueden
--     pertenecer a otro household.
--   * Splits: constraint trigger diferido; al hacer commit, la suma de share_bp debe ser 10000,
--     la suma de amount debe ser el monto del gasto y cada amount debe coincidir con el reparto
--     determinista de private.allocate_split_amounts(). Ningún camino de escritura (RPC o
--     tabla directa) puede dejar un gasto inconsistente.
--   * Movimientos financieros no se borran: se anulan (status = 'voided'), spec §22.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Clave de icono (p. ej. 'utensils'); la UI decide cómo representarla.
  icon text check (icon is null or char_length(icon) <= 40),
  archived_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create unique index categories_household_kind_name_key
  on public.categories (household_id, kind, lower(name));

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  amount bigint not null check (amount between 1 and 100000000000000),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('monthly', 'quarterly')),
  next_due_date date not null check (next_due_date between '2000-01-01' and '2100-12-31'),
  category_id uuid not null,
  paid_by uuid not null,
  split_type text not null default 'equal' check (split_type in ('equal', 'percentage')),
  notes text check (notes is null or char_length(notes) <= 500),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id) references public.categories (id, household_id),
  foreign key (household_id, paid_by) references public.household_members (household_id, user_id)
);

-- División predeterminada de la plantilla (sin montos: se calculan al generar el gasto).
create table public.recurring_expense_splits (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null,
  household_id uuid not null,
  user_id uuid not null,
  share_bp integer not null check (share_bp between 0 and 10000),
  unique (recurring_expense_id, user_id),
  foreign key (recurring_expense_id, household_id)
    references public.recurring_expenses (id, household_id) on delete cascade,
  foreign key (household_id, user_id) references public.household_members (household_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  -- Tope 10^14: muy por debajo de Number.MAX_SAFE_INTEGER (~9·10^15) en el cliente.
  amount bigint not null check (amount between 1 and 100000000000000),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  date date not null default private.today_bogota()
    check (date between '2000-01-01' and '2100-12-31'),
  category_id uuid not null,
  paid_by uuid not null,
  split_type text not null default 'equal' check (split_type in ('equal', 'percentage')),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  -- Ocurrencia de una plantilla recurrente (FASE 9). Evita generar dos veces la misma fecha.
  recurring_expense_id uuid,
  recurring_due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id) references public.categories (id, household_id),
  foreign key (household_id, paid_by) references public.household_members (household_id, user_id),
  foreign key (recurring_expense_id, household_id)
    references public.recurring_expenses (id, household_id),
  check ((status = 'voided') = (voided_at is not null)),
  check ((recurring_expense_id is null) = (recurring_due_date is null))
);

create unique index expenses_recurring_occurrence_key
  on public.expenses (recurring_expense_id, recurring_due_date)
  where recurring_expense_id is not null and status = 'active';

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  household_id uuid not null,
  user_id uuid not null,
  share_bp integer not null check (share_bp between 0 and 10000),
  amount bigint not null check (amount >= 0),
  unique (expense_id, user_id),
  foreign key (expense_id, household_id)
    references public.expenses (id, household_id) on delete cascade,
  foreign key (household_id, user_id) references public.household_members (household_id, user_id)
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  -- Los ingresos pertenecen a quien los recibe y no generan deuda (spec §6).
  user_id uuid not null default auth.uid(),
  source text not null check (char_length(btrim(source)) between 1 and 120),
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
  -- MATCH SIMPLE: con category_id nulo la FK no se evalúa (categoría opcional).
  foreign key (category_id, household_id) references public.categories (id, household_id),
  check ((status = 'voided') = (voided_at is not null))
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  from_user uuid not null,
  to_user uuid not null,
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
  foreign key (household_id, from_user) references public.household_members (household_id, user_id),
  foreign key (household_id, to_user) references public.household_members (household_id, user_id),
  check (from_user <> to_user),
  check ((status = 'voided') = (voided_at is not null))
);

-- ---------------------------------------------------------------------------
-- Índices (spec §45): household_id + fecha para listados, y columnas de FK.
-- ---------------------------------------------------------------------------
create index categories_household_id_idx on public.categories (household_id);
create index expenses_household_date_idx on public.expenses (household_id, date desc);
create index expenses_category_idx on public.expenses (category_id, household_id);
create index expenses_paid_by_idx on public.expenses (household_id, paid_by);
create index expenses_recurring_idx on public.expenses (recurring_expense_id, household_id)
  where recurring_expense_id is not null;
create index expense_splits_expense_idx on public.expense_splits (expense_id, household_id);
create index expense_splits_user_idx on public.expense_splits (household_id, user_id);
create index incomes_household_date_idx on public.incomes (household_id, date desc);
create index incomes_user_idx on public.incomes (household_id, user_id);
create index incomes_category_idx on public.incomes (category_id, household_id)
  where category_id is not null;
create index transfers_household_date_idx on public.transfers (household_id, date desc);
create index transfers_from_idx on public.transfers (household_id, from_user);
create index transfers_to_idx on public.transfers (household_id, to_user);
create index recurring_expenses_household_due_idx
  on public.recurring_expenses (household_id, next_due_date) where active;
create index recurring_expenses_category_idx on public.recurring_expenses (category_id, household_id);
create index recurring_expenses_paid_by_idx on public.recurring_expenses (household_id, paid_by);
create index recurring_expense_splits_parent_idx
  on public.recurring_expense_splits (recurring_expense_id, household_id);
create index recurring_expense_splits_user_idx
  on public.recurring_expense_splits (household_id, user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_expense_splits enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.incomes enable row level security;
alter table public.transfers enable row level security;

-- ---------------------------------------------------------------------------
-- Funciones de reparto y validación
-- ---------------------------------------------------------------------------

-- Reparto determinista de un monto según puntos básicos (método del mayor resto).
-- Cada persona recibe floor(monto · bp / 10000); los pesos sobrantes (menos que el número
-- de participantes) se asignan de uno en uno por mayor resto y, a igualdad, por user_id.
-- p_shares: [{"user_id": "...", "share_bp": 5000}, ...]
create function private.allocate_split_amounts(p_amount bigint, p_shares jsonb)
returns table (user_id uuid, share_bp integer, amount bigint)
language sql
immutable
set search_path = ''
as $$
  with shares as (
    select (e ->> 'user_id')::uuid as user_id, (e ->> 'share_bp')::integer as share_bp
    from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) as e
  ),
  base as (
    select
      s.user_id,
      s.share_bp,
      floor(p_amount::numeric * s.share_bp / 10000)::bigint as floor_amount,
      (p_amount::numeric * s.share_bp) % 10000 as remainder
    from shares s
  ),
  ranked as (
    select
      b.*,
      row_number() over (order by b.remainder desc, b.user_id) as rn,
      p_amount - sum(b.floor_amount) over () as leftover
    from base b
  )
  select r.user_id, r.share_bp, r.floor_amount + case when r.rn <= r.leftover then 1 else 0 end
  from ranked r;
$$;

-- Normaliza la división pedida a [{user_id, share_bp}] con suma 10000.
--   equal:      p_participants = [uuid, ...] (por defecto, todos los miembros activos).
--   percentage: p_participants = [{"user_id": "...", "share_bp": 7000}, ...]
create function private.build_shares(p_household_id uuid, p_split_type text, p_participants jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
  v_count int;
  v_shares jsonb;
  v_total bigint;
begin
  if p_split_type = 'equal' then
    if p_participants is null or jsonb_array_length(p_participants) = 0 then
      select array_agg(m.user_id order by m.user_id) into v_users
      from public.household_members m
      where m.household_id = p_household_id and m.left_at is null;
    else
      select array_agg(distinct u.value::uuid order by u.value::uuid) into v_users
      from jsonb_array_elements_text(p_participants) as u;
    end if;

    v_count := coalesce(array_length(v_users, 1), 0);
    if v_count = 0 then
      raise exception using message = 'invalid_split', errcode = '23514';
    end if;

    -- 10000 / n por persona; los puntos sobrantes van a los primeros por user_id.
    select jsonb_agg(
      jsonb_build_object(
        'user_id', u.user_id,
        'share_bp', (10000 / v_count) + case when u.ord <= 10000 % v_count then 1 else 0 end
      )
    ) into v_shares
    from unnest(v_users) with ordinality as u (user_id, ord);

    return v_shares;
  end if;

  if p_split_type = 'percentage' then
    if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
      raise exception using message = 'invalid_split', errcode = '23514';
    end if;

    select coalesce(sum((e ->> 'share_bp')::bigint), 0) into v_total
    from jsonb_array_elements(p_participants) as e;

    if v_total <> 10000 then
      raise exception using message = 'split_must_total_100', errcode = '23514';
    end if;

    return p_participants;
  end if;

  raise exception using message = 'invalid_split', errcode = '23514';
end;
$$;

create function private.assert_expense_splits_consistent(p_expense_id uuid)
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
  select e.amount into v_amount from public.expenses e where e.id = p_expense_id;
  if not found then
    return;
  end if;

  select
    jsonb_agg(jsonb_build_object('user_id', s.user_id, 'share_bp', s.share_bp)),
    coalesce(sum(s.share_bp), 0)
  into v_shares, v_total_bp
  from public.expense_splits s
  where s.expense_id = p_expense_id;

  if v_total_bp <> 10000 or exists (
    select 1
    from (select s.user_id, s.amount from public.expense_splits s where s.expense_id = p_expense_id) actual
    full join private.allocate_split_amounts(v_amount, v_shares) expected using (user_id)
    where actual.amount is distinct from expected.amount
  ) then
    raise exception using
      message = 'invalid_expense_splits',
      errcode = '23514',
      detail = format('expense %s: los splits no suman 100 %% o no cuadran con el monto', p_expense_id);
  end if;
end;
$$;

create function private.check_splits_on_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_expense_splits_consistent(new.id);
  return null;
end;
$$;

create function private.check_splits_on_split()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_expense_splits_consistent(old.expense_id);
  else
    perform private.assert_expense_splits_consistent(new.expense_id);
  end if;
  return null;
end;
$$;

create function private.assert_recurring_splits_consistent(p_recurring_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_bp bigint;
begin
  if not exists (select 1 from public.recurring_expenses r where r.id = p_recurring_expense_id) then
    return;
  end if;

  select coalesce(sum(s.share_bp), 0) into v_total_bp
  from public.recurring_expense_splits s
  where s.recurring_expense_id = p_recurring_expense_id;

  if v_total_bp <> 10000 then
    raise exception using message = 'invalid_recurring_splits', errcode = '23514';
  end if;
end;
$$;

create function private.check_splits_on_recurring()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_recurring_splits_consistent(new.id);
  return null;
end;
$$;

create function private.check_splits_on_recurring_split()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_recurring_splits_consistent(old.recurring_expense_id);
  else
    perform private.assert_recurring_splits_consistent(new.recurring_expense_id);
  end if;
  return null;
end;
$$;

-- Las personas referenciadas al crear o cambiar un registro deben ser miembros ACTIVOS.
-- (La FK compuesta garantiza que fueron miembros; esto impide usar a alguien que ya se fue.)
-- TG_ARGV: nombres de las columnas de usuario a comprobar.
create function private.require_active_members()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text;
  v_new uuid;
  v_old uuid;
begin
  foreach v_column in array tg_argv loop
    v_new := (to_jsonb(new) ->> v_column)::uuid;
    if tg_op = 'UPDATE' then
      v_old := (to_jsonb(old) ->> v_column)::uuid;
      continue when v_new is not distinct from v_old;
    end if;
    if not private.is_active_member(new.household_id, v_new) then
      raise exception using message = 'user_not_active_member', errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

-- La categoría debe ser del tipo correcto (gasto/ingreso). TG_ARGV[0] = kind esperado.
-- SECURITY DEFINER: solo compara el tipo; que la categoría sea del mismo household lo exigen
-- la FK compuesta y RLS, que se evalúan después de los triggers BEFORE.
create function private.require_category_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.kind = tg_argv[0]
  ) then
    raise exception using message = 'invalid_category', errcode = '23514';
  end if;
  return new;
end;
$$;

-- Anulación (soft-delete): se crea siempre activo; anular fija voided_at/voided_by;
-- un registro anulado ya no se puede modificar ni reactivar.
create function private.guard_voidable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'active';
    new.voided_at := null;
    new.voided_by := null;
    return new;
  end if;

  if old.status = 'voided' then
    raise exception using message = 'record_voided', errcode = 'P0001';
  end if;

  if new.status = 'voided' then
    new.voided_at := now();
    new.voided_by := coalesce(auth.uid(), new.voided_by);
  else
    new.voided_at := null;
    new.voided_by := null;
  end if;
  return new;
end;
$$;

-- Los splits de un gasto anulado son de solo lectura.
create function private.guard_split_parent_active()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expense_id uuid;
begin
  v_expense_id := case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  if exists (select 1 from public.expenses e where e.id = v_expense_id and e.status = 'voided') then
    raise exception using message = 'record_voided', errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Categorías iniciales (spec §13 y ejemplos de ingresos de §6), copiadas por household.
create function private.seed_default_categories(p_household_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.categories (household_id, kind, name, icon)
  values
    (p_household_id, 'expense', 'Comida', 'utensils'),
    (p_household_id, 'expense', 'Vivienda', 'home'),
    (p_household_id, 'expense', 'Servicios', 'plug'),
    (p_household_id, 'expense', 'Transporte', 'bus'),
    (p_household_id, 'expense', 'Entretenimiento', 'film'),
    (p_household_id, 'expense', 'Salud', 'heart-pulse'),
    (p_household_id, 'expense', 'Educación', 'graduation-cap'),
    (p_household_id, 'expense', 'Suscripciones', 'repeat'),
    (p_household_id, 'expense', 'Compras', 'shopping-bag'),
    (p_household_id, 'expense', 'Otros', 'ellipsis'),
    (p_household_id, 'income', 'Mesada', 'piggy-bank'),
    (p_household_id, 'income', 'Trabajo', 'briefcase'),
    (p_household_id, 'income', 'Freelance', 'laptop'),
    (p_household_id, 'income', 'Beca', 'award'),
    (p_household_id, 'income', 'Otro', 'ellipsis');
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- (Los BEFORE se disparan en orden alfabético por nombre; ninguno depende de otro.)
-- ---------------------------------------------------------------------------

-- Auditoría
create trigger categories_audit before insert or update on public.categories
  for each row execute function private.set_audit_fields();
create trigger recurring_expenses_audit before insert or update on public.recurring_expenses
  for each row execute function private.set_audit_fields();
create trigger expenses_audit before insert or update on public.expenses
  for each row execute function private.set_audit_fields();
create trigger incomes_audit before insert or update on public.incomes
  for each row execute function private.set_audit_fields();
create trigger transfers_audit before insert or update on public.transfers
  for each row execute function private.set_audit_fields();

-- household_id inmutable
create trigger categories_household_immutable before update on public.categories
  for each row execute function private.prevent_household_change();
create trigger recurring_expenses_household_immutable before update on public.recurring_expenses
  for each row execute function private.prevent_household_change();
create trigger recurring_expense_splits_household_immutable before update on public.recurring_expense_splits
  for each row execute function private.prevent_household_change();
create trigger expenses_household_immutable before update on public.expenses
  for each row execute function private.prevent_household_change();
create trigger incomes_household_immutable before update on public.incomes
  for each row execute function private.prevent_household_change();
create trigger transfers_household_immutable before update on public.transfers
  for each row execute function private.prevent_household_change();

-- Miembros activos
create trigger expenses_active_members before insert or update on public.expenses
  for each row execute function private.require_active_members('paid_by');
create trigger expense_splits_active_members before insert on public.expense_splits
  for each row execute function private.require_active_members('user_id');
create trigger incomes_active_members before insert or update on public.incomes
  for each row execute function private.require_active_members('user_id');
create trigger transfers_active_members before insert or update on public.transfers
  for each row execute function private.require_active_members('from_user', 'to_user');
create trigger recurring_expenses_active_members before insert or update on public.recurring_expenses
  for each row execute function private.require_active_members('paid_by');
create trigger recurring_expense_splits_active_members before insert or update on public.recurring_expense_splits
  for each row execute function private.require_active_members('user_id');

-- Tipo de categoría
create trigger expenses_category_kind before insert or update of category_id on public.expenses
  for each row execute function private.require_category_kind('expense');
create trigger recurring_expenses_category_kind before insert or update of category_id on public.recurring_expenses
  for each row execute function private.require_category_kind('expense');
create trigger incomes_category_kind before insert or update of category_id on public.incomes
  for each row execute function private.require_category_kind('income');

-- Anulación
create trigger expenses_voidable before insert or update on public.expenses
  for each row execute function private.guard_voidable();
create trigger incomes_voidable before insert or update on public.incomes
  for each row execute function private.guard_voidable();
create trigger transfers_voidable before insert or update on public.transfers
  for each row execute function private.guard_voidable();
create trigger expense_splits_parent_active before insert or delete on public.expense_splits
  for each row execute function private.guard_split_parent_active();

-- Consistencia de splits, comprobada al final de la transacción
create constraint trigger expenses_splits_consistent
  after insert or update of amount on public.expenses
  deferrable initially deferred
  for each row execute function private.check_splits_on_expense();
create constraint trigger expense_splits_consistent
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function private.check_splits_on_split();
create constraint trigger recurring_expenses_splits_consistent
  after insert on public.recurring_expenses
  deferrable initially deferred
  for each row execute function private.check_splits_on_recurring();
create constraint trigger recurring_expense_splits_consistent
  after insert or update or delete on public.recurring_expense_splits
  deferrable initially deferred
  for each row execute function private.check_splits_on_recurring_split();

-- ---------------------------------------------------------------------------
-- Políticas RLS: todo acceso pasa por "es miembro activo del household del registro".
-- Sin políticas DELETE en movimientos financieros: se anulan, no se borran.
-- ---------------------------------------------------------------------------

create policy "categories: ver las de mi household" on public.categories
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "categories: crear en mi household" on public.categories
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "categories: editar las de mi household" on public.categories
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));
-- Borrar solo funciona si ninguna fila la referencia (las FK lo impiden); si no, se archiva.
create policy "categories: borrar las de mi household" on public.categories
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

create policy "expenses: ver los de mi household" on public.expenses
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "expenses: crear en mi household" on public.expenses
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "expenses: editar los de mi household" on public.expenses
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));

create policy "expense_splits: ver los de mi household" on public.expense_splits
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "expense_splits: crear en mi household" on public.expense_splits
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "expense_splits: borrar los de mi household" on public.expense_splits
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

create policy "incomes: ver los de mi household" on public.incomes
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "incomes: crear los míos" on public.incomes
  for insert to authenticated
  with check (
    household_id in (select private.current_household_ids())
    and user_id = (select auth.uid())
  );
create policy "incomes: editar los míos" on public.incomes
  for update to authenticated
  using (
    household_id in (select private.current_household_ids())
    and user_id = (select auth.uid())
  )
  with check (
    household_id in (select private.current_household_ids())
    and user_id = (select auth.uid())
  );

create policy "transfers: ver las de mi household" on public.transfers
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "transfers: crear en mi household" on public.transfers
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "transfers: editar las de mi household" on public.transfers
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));

create policy "recurring_expenses: ver los de mi household" on public.recurring_expenses
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "recurring_expenses: crear en mi household" on public.recurring_expenses
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "recurring_expenses: editar los de mi household" on public.recurring_expenses
  for update to authenticated
  using (household_id in (select private.current_household_ids()))
  with check (household_id in (select private.current_household_ids()));
create policy "recurring_expenses: borrar los de mi household" on public.recurring_expenses
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

create policy "recurring_expense_splits: ver los de mi household" on public.recurring_expense_splits
  for select to authenticated
  using (household_id in (select private.current_household_ids()));
create policy "recurring_expense_splits: crear en mi household" on public.recurring_expense_splits
  for insert to authenticated
  with check (household_id in (select private.current_household_ids()));
create policy "recurring_expense_splits: borrar los de mi household" on public.recurring_expense_splits
  for delete to authenticated
  using (household_id in (select private.current_household_ids()));

-- ---------------------------------------------------------------------------
-- RPC atómicas para gastos (spec §32). SECURITY INVOKER: RLS se aplica igual que en una
-- escritura directa; la función solo aporta atomicidad y el cálculo del reparto.
-- ---------------------------------------------------------------------------

create function public.create_expense(
  p_household_id uuid,
  p_description text,
  p_amount bigint,
  p_category_id uuid,
  p_paid_by uuid,
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
  v_expense_id uuid;
  v_shares jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  v_shares := private.build_shares(p_household_id, p_split_type, p_participants);

  insert into public.expenses (
    household_id, description, amount, currency, date, category_id, paid_by, split_type, notes
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
    nullif(btrim(p_notes), '')
  )
  returning id into v_expense_id;

  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  select v_expense_id, p_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;

  return v_expense_id;
end;
$$;

comment on function public.create_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text) is
  'Crea un gasto y sus splits en una sola transacción. equal: p_participants = [user_id...] '
  '(por defecto todos los miembros activos). percentage: [{"user_id","share_bp"}] con suma 10000.';

create function public.update_expense(
  p_expense_id uuid,
  p_description text,
  p_amount bigint,
  p_category_id uuid,
  p_paid_by uuid,
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
    notes = nullif(btrim(p_notes), '')
  where id = p_expense_id;

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  select p_expense_id, v_household_id, a.user_id, a.share_bp, a.amount
  from private.allocate_split_amounts(p_amount, v_shares) as a;
end;
$$;

comment on function public.update_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text) is
  'Edita un gasto activo y reemplaza sus splits en una sola transacción.';

create function public.void_expense(p_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  update public.expenses set status = 'voided' where id = p_expense_id;
  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;
end;
$$;

comment on function public.void_expense(uuid) is 'Anula un gasto (no se borra; spec §22).';

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant select, insert, delete on public.categories to authenticated;
grant update (name, icon, archived_at) on public.categories to authenticated;

grant select on public.expenses to authenticated;
grant insert (household_id, description, amount, currency, date, category_id, paid_by, split_type, notes)
  on public.expenses to authenticated;
grant update (description, amount, date, category_id, paid_by, split_type, notes, status)
  on public.expenses to authenticated;

grant select, insert, delete on public.expense_splits to authenticated;

grant select on public.incomes to authenticated;
grant insert (household_id, user_id, source, amount, currency, date, category_id, notes)
  on public.incomes to authenticated;
grant update (source, amount, date, category_id, notes, status) on public.incomes to authenticated;

grant select on public.transfers to authenticated;
grant insert (household_id, from_user, to_user, amount, currency, date, notes)
  on public.transfers to authenticated;
grant update (from_user, to_user, amount, date, notes, status) on public.transfers to authenticated;

grant select, delete on public.recurring_expenses to authenticated;
grant insert (household_id, name, amount, currency, frequency, next_due_date, category_id, paid_by, split_type, notes, active)
  on public.recurring_expenses to authenticated;
grant update (name, amount, frequency, next_due_date, category_id, paid_by, split_type, notes, active)
  on public.recurring_expenses to authenticated;

grant select, insert, delete on public.recurring_expense_splits to authenticated;

grant execute on function private.allocate_split_amounts(bigint, jsonb) to authenticated;
-- Los constraint triggers se ejecutan con el rol de quien escribe: necesita poder invocarlas.
grant execute on function private.assert_expense_splits_consistent(uuid) to authenticated;
grant execute on function private.assert_recurring_splits_consistent(uuid) to authenticated;
grant execute on function private.build_shares(uuid, text, jsonb) to authenticated;

grant execute on function public.create_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text) to authenticated;
grant execute on function public.update_expense(uuid, text, bigint, uuid, uuid, text, jsonb, date, text) to authenticated;
grant execute on function public.void_expense(uuid) to authenticated;
