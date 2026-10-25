-- =============================================================================
-- BULLMILTON · 04 · Gastos recurrentes (FASE 9)
--
-- Plantillas con división predeterminada; al abrir la app se muestran las vencidas y la
-- persona confirma (spec §15). Confirmar crea el gasto y adelanta la próxima fecha en una sola
-- transacción; el índice único (recurring_expense_id, recurring_due_date) impide duplicados.
-- =============================================================================

-- Día de anclaje: una plantilla del 31 cae el 30 en abril y vuelve al 31 en mayo.
alter table public.recurring_expenses
  add column anchor_day smallint not null default 1 check (anchor_day between 1 and 31);

-- Borrar una plantilla conserva los gastos que ya generó (solo se desvinculan).
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.expenses'::regclass
    and contype = 'f'
    and confrelid = 'public.recurring_expenses'::regclass;
  execute format('alter table public.expenses drop constraint %I', v_name);

  select conname into v_name
  from pg_constraint
  where conrelid = 'public.expenses'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%recurring_expense_id IS NULL%recurring_due_date IS NULL%';
  execute format('alter table public.expenses drop constraint %I', v_name);
end;
$$;

alter table public.expenses
  add constraint expenses_recurring_fkey
    foreign key (recurring_expense_id, household_id)
    references public.recurring_expenses (id, household_id)
    on delete set null (recurring_expense_id),
  add constraint expenses_recurring_due_date_check
    check (recurring_expense_id is null or recurring_due_date is not null);

-- Próxima ocurrencia: +1 o +3 meses, en el día de anclaje o el último día del mes.
create function private.next_occurrence(p_date date, p_frequency text, p_anchor_day int)
returns date
language sql
immutable
set search_path = ''
as $$
  with target as (
    select (date_trunc('month', p_date)
            + make_interval(months => case p_frequency when 'quarterly' then 3 else 1 end))::date
      as month_start
  )
  select (month_start
          + (least(
               p_anchor_day,
               extract(day from (month_start + interval '1 month - 1 day'))::int
             ) - 1))::date
  from target;
$$;

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
  p_notes text default null
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
    category_id, paid_by, split_type, notes
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
    nullif(btrim(p_notes), '')
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
  p_active boolean default true
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
    active = p_active
  where id = p_recurring_expense_id;

  delete from public.recurring_expense_splits where recurring_expense_id = p_recurring_expense_id;

  insert into public.recurring_expense_splits (recurring_expense_id, household_id, user_id, share_bp)
  select p_recurring_expense_id, v_household_id, (e ->> 'user_id')::uuid, (e ->> 'share_bp')::integer
  from jsonb_array_elements(v_shares) as e;
end;
$$;

-- Confirma la ocurrencia vencida: crea el gasto (monto y fecha ajustables) y adelanta la fecha.
create function public.generate_recurring_expense(
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
    notes, recurring_expense_id, recurring_due_date
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
    v_template.next_due_date
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

-- Salta una ocurrencia (p. ej. un mes sin Netflix) sin crear gasto.
create function public.skip_recurring_expense(p_recurring_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.recurring_expenses%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  select * into v_template
  from public.recurring_expenses
  where id = p_recurring_expense_id
  for update;

  if not found then
    raise exception using message = 'not_found', errcode = 'P0002';
  end if;

  update public.recurring_expenses
  set next_due_date = private.next_occurrence(
    v_template.next_due_date, v_template.frequency, v_template.anchor_day
  )
  where id = p_recurring_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant insert (anchor_day) on public.recurring_expenses to authenticated;
grant update (anchor_day) on public.recurring_expenses to authenticated;
grant insert (recurring_expense_id, recurring_due_date) on public.expenses to authenticated;

grant execute on function private.next_occurrence(date, text, int) to authenticated;
grant execute on function public.create_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.update_recurring_expense(uuid, text, bigint, text, date, uuid, uuid, text, jsonb, text, boolean) to authenticated;
grant execute on function public.generate_recurring_expense(uuid, bigint, date) to authenticated;
grant execute on function public.skip_recurring_expense(uuid) to authenticated;
