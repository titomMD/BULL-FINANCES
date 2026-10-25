-- BULLMILTON · pgTAP · Endurecimiento general (spec §27-§29)
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- RLS habilitado en TODAS las tablas de public.
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'RLS está habilitado en todas las tablas de public'
);

-- Todas las tablas de public tienen al menos una política (RLS sin políticas = tabla inaccesible,
-- lo que suele indicar un olvido).
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  $$,
  'Todas las tablas de public tienen políticas RLS'
);

-- anon no tiene ningún privilegio sobre tablas ni columnas de public.
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
      )
  $$,
  'anon no tiene privilegios sobre tablas de public'
);

-- anon no puede ejecutar ninguna función propia de public ni de private.
select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anon no puede ejecutar funciones de public ni de private'
);

-- Toda función SECURITY DEFINER fija search_path (evita secuestro de search_path).
select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg where cfg like 'search_path=%'
      )
  $$,
  'Todas las funciones SECURITY DEFINER fijan search_path'
);

-- El esquema private no es accesible para anon.
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon no tiene USAGE sobre el esquema private'
);

-- Sin sesión: acceso denegado a datos y RPC.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select * from public.expenses',
  '42501',
  null,
  'anon no puede leer gastos'
);

select throws_ok(
  'select * from public.households',
  '42501',
  null,
  'anon no puede leer households'
);

select throws_ok(
  $$ select public.create_household('Intruso') $$,
  '42501',
  null,
  'anon no puede crear households'
);

reset role;

select * from finish();
rollback;
