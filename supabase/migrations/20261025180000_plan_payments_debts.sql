-- Freyapp · Pagos del plan, tanqueadas, tarjetas/deudas y extractos (pedido del usuario, 2026-10-25)
--
-- 1) plan_items.tracked: la línea lleva registros de gasto del mes (p. ej. las tanqueadas de la gasolina).
-- 2) plan_checks: «ya pagué esto este mes» (una fila = pagado; borrarla = desmarcar).
-- 3) plan_entries: cada tanqueada (o gasto) de una línea con tracked = true.
-- 4) debt_accounts / debt_statements: tarjetas de crédito o deudas y los datos de cada extracto.
-- 5) personal_movements.plan_month: el ingreso «Dinero mío» que el plan genera solo cada mes.
-- 6) Bucket privado de Storage para extractos e imágenes de tarjetas (cada quien solo su carpeta).
--
-- Todo es privado (RLS por user_id, como plan_items). Los montos son enteros en COP.

-- ---------------------------------------------------------------------------
-- 1) Líneas con registro de gastos
-- ---------------------------------------------------------------------------
alter table public.plan_items add column tracked boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Pagos marcados
-- ---------------------------------------------------------------------------
create table public.plan_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  plan_item_id uuid not null references public.plan_items (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  unique (plan_item_id, month)
);

comment on table public.plan_checks is
  'Líneas del plan marcadas como pagadas en un mes. Privado; borrar la fila desmarca.';

create index plan_checks_owner_idx on public.plan_checks (household_id, user_id, month);

-- ---------------------------------------------------------------------------
-- 3) Tanqueadas / gastos de una línea del plan
-- ---------------------------------------------------------------------------
create table public.plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  plan_item_id uuid not null references public.plan_items (id) on delete cascade,
  entry_date date not null default private.today_bogota()
    check (entry_date between '2000-01-01' and '2100-12-31'),
  amount bigint not null check (amount between 1 and 100000000000000),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id)
);

comment on table public.plan_entries is
  'Gastos registrados contra una línea del plan (p. ej. tanqueadas). Privado.';

create index plan_entries_owner_idx on public.plan_entries (household_id, user_id, entry_date desc);
create index plan_entries_item_idx on public.plan_entries (plan_item_id);

-- ---------------------------------------------------------------------------
-- 4) Tarjetas / deudas y sus extractos
-- ---------------------------------------------------------------------------
create table public.debt_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Solo los últimos 4 dígitos: nunca el número completo.
  last4 text check (last4 is null or last4 ~ '^\d{4}$'),
  cut_day int check (cut_day is null or cut_day between 1 and 31),
  due_day int check (due_day is null or due_day between 1 and 31),
  notes text check (notes is null or char_length(notes) <= 500),
  image_path text check (image_path is null or image_path like user_id::text || '/%'),
  archived_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  unique (id, user_id)
);

comment on table public.debt_accounts is
  'Tarjetas de crédito o deudas de una persona. Privado; solo últimos 4 dígitos.';

create index debt_accounts_owner_idx on public.debt_accounts (household_id, user_id);

create table public.debt_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  user_id uuid not null default auth.uid(),
  account_id uuid not null,
  -- Fecha de corte del extracto y fecha límite de pago.
  statement_date date not null check (statement_date between '2000-01-01' and '2100-12-31'),
  due_date date check (due_date is null or due_date between '2000-01-01' and '2100-12-31'),
  -- Mes del plan en el que se paga (por defecto, el de la fecha límite).
  pay_month text not null check (pay_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total_due bigint not null default 0 check (total_due between 0 and 100000000000000),
  minimum_due bigint not null default 0 check (minimum_due between 0 and 100000000000000),
  previous_balance bigint check (previous_balance is null or previous_balance between 0 and 100000000000000),
  interest bigint check (interest is null or interest between 0 and 100000000000000),
  purchases bigint check (purchases is null or purchases between 0 and 100000000000000),
  -- Lo que realmente se pagó de este extracto (0 = aún no).
  paid_amount bigint not null default 0 check (paid_amount between 0 and 100000000000000),
  paid_on date check (paid_on is null or paid_on between '2000-01-01' and '2100-12-31'),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Movimientos copiados del extracto (lista libre: fecha, detalle, valor). Solo consulta.
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  file_path text check (file_path is null or file_path like user_id::text || '/%'),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id),
  foreign key (account_id, user_id) references public.debt_accounts (id, user_id) on delete cascade,
  check (octet_length(lines::text) <= 200000)
);

comment on table public.debt_statements is
  'Extractos de tarjetas/deudas: datos copiados para consulta y pago del mes. Privado.';

create index debt_statements_owner_idx
  on public.debt_statements (household_id, user_id, account_id, statement_date desc);
create index debt_statements_pay_month_idx on public.debt_statements (user_id, pay_month);

-- ---------------------------------------------------------------------------
-- 5) «Dinero mío» del plan como ingreso del dinero personal
-- ---------------------------------------------------------------------------
alter table public.personal_movements
  add column plan_month text check (plan_month is null or plan_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Un solo ingreso activo del plan por mes y persona. Si se anula (cuando el plan no deja nada),
-- puede crearse otro después: el índice solo mira los activos.
create unique index personal_movements_plan_month_uidx
  on public.personal_movements (user_id, plan_month)
  where plan_month is not null and status = 'active';

-- ---------------------------------------------------------------------------
-- Auditoría, RLS y privilegios de las tablas nuevas
-- ---------------------------------------------------------------------------
create trigger plan_checks_audit before insert or update on public.plan_checks
  for each row execute function private.set_audit_fields();
create trigger plan_entries_audit before insert or update on public.plan_entries
  for each row execute function private.set_audit_fields();
create trigger debt_accounts_audit before insert or update on public.debt_accounts
  for each row execute function private.set_audit_fields();
create trigger debt_statements_audit before insert or update on public.debt_statements
  for each row execute function private.set_audit_fields();

create trigger plan_checks_household_immutable before update on public.plan_checks
  for each row execute function private.prevent_household_change();
create trigger plan_entries_household_immutable before update on public.plan_entries
  for each row execute function private.prevent_household_change();
create trigger debt_accounts_household_immutable before update on public.debt_accounts
  for each row execute function private.prevent_household_change();
create trigger debt_statements_household_immutable before update on public.debt_statements
  for each row execute function private.prevent_household_change();

alter table public.plan_checks enable row level security;
alter table public.plan_entries enable row level security;
alter table public.debt_accounts enable row level security;
alter table public.debt_statements enable row level security;

-- plan_checks: ver, marcar y desmarcar lo mío (no se edita).
create policy "plan_checks: ver los míos" on public.plan_checks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plan_checks: crear los míos" on public.plan_checks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
    and exists (
      select 1 from public.plan_items p
      where p.id = plan_item_id and p.user_id = (select auth.uid())
    )
  );
create policy "plan_checks: borrar los míos" on public.plan_checks
  for delete to authenticated using (user_id = (select auth.uid()));

-- plan_entries
create policy "plan_entries: ver los míos" on public.plan_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plan_entries: crear los míos" on public.plan_entries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
    and exists (
      select 1 from public.plan_items p
      where p.id = plan_item_id and p.user_id = (select auth.uid())
    )
  );
create policy "plan_entries: editar los míos" on public.plan_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plan_entries: borrar los míos" on public.plan_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- debt_accounts
create policy "debt_accounts: ver los míos" on public.debt_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "debt_accounts: crear los míos" on public.debt_accounts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "debt_accounts: editar los míos" on public.debt_accounts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "debt_accounts: borrar los míos" on public.debt_accounts
  for delete to authenticated using (user_id = (select auth.uid()));

-- debt_statements
create policy "debt_statements: ver los míos" on public.debt_statements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "debt_statements: crear los míos" on public.debt_statements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and household_id in (select private.current_household_ids())
  );
create policy "debt_statements: editar los míos" on public.debt_statements
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "debt_statements: borrar los míos" on public.debt_statements
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 6) Archivos (extractos e imágenes de tarjetas): bucket privado, una carpeta por persona.
--    En la base de pruebas local (sin Storage) este bloque se salta solo.
-- ---------------------------------------------------------------------------
do $storage$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'freyapp-files', 'freyapp-files', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy "freyapp-files: ver los míos" on storage.objects
    for select to authenticated
    using (bucket_id = 'freyapp-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "freyapp-files: subir los míos" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'freyapp-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "freyapp-files: borrar los míos" on storage.objects
    for delete to authenticated
    using (bucket_id = 'freyapp-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end
$storage$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant insert (tracked) on public.plan_items to authenticated;
grant update (tracked) on public.plan_items to authenticated;

grant select, delete on public.plan_checks to authenticated;
grant insert (household_id, plan_item_id, month) on public.plan_checks to authenticated;

grant select, delete on public.plan_entries to authenticated;
grant insert (household_id, plan_item_id, entry_date, amount, note) on public.plan_entries to authenticated;
grant update (entry_date, amount, note) on public.plan_entries to authenticated;

grant select, delete on public.debt_accounts to authenticated;
grant insert (household_id, name, last4, cut_day, due_day, notes, image_path)
  on public.debt_accounts to authenticated;
grant update (name, last4, cut_day, due_day, notes, image_path, archived_at)
  on public.debt_accounts to authenticated;

grant select, delete on public.debt_statements to authenticated;
grant insert (household_id, account_id, statement_date, due_date, pay_month, total_due, minimum_due,
              previous_balance, interest, purchases, paid_amount, paid_on, notes, lines, file_path, file_name)
  on public.debt_statements to authenticated;
grant update (statement_date, due_date, pay_month, total_due, minimum_due, previous_balance,
              interest, purchases, paid_amount, paid_on, notes, lines, file_path, file_name)
  on public.debt_statements to authenticated;

grant insert (plan_month) on public.personal_movements to authenticated;
