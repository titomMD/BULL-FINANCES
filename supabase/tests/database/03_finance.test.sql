-- BULLMILTON · pgTAP · Gastos, splits, ingresos y transferencias (spec §8, §29, §31, §32)
--
-- Household H: A y B.  Household H2: C (externo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- ---------------------------------------------------------------------------
-- Helpers y datos
-- ---------------------------------------------------------------------------
create function pg_temp.create_user(p_id uuid, p_email text, p_name text)
returns void
language sql
as $$
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (p_id, p_email, 'authenticated', 'authenticated', jsonb_build_object('display_name', p_name));
$$;

create function pg_temp.login_as(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.id(p_name text)
returns uuid
language sql
as $$
  select current_setting('test.' || p_name)::uuid;
$$;

-- Ejecuta un intento de ataque sin abortar el archivo si falla o si (por un bug) tiene éxito;
-- el resultado se comprueba después con una aserción.
create function pg_temp.attempt(p_sql text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
exception when others then
  null;
end;
$$;

-- Fuerza la comprobación inmediata de las constraints diferidas (equivale a hacer commit).
create function pg_temp.check_deferred()
returns void
language plpgsql
as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;

-- Escrituras directas a las tablas (sin la RPC) seguidas de la comprobación de commit.
-- Van en una función para que throws_ok deshaga el insert junto con el error.
create function pg_temp.try_expense_without_splits()
returns void
language plpgsql
as $$
begin
  insert into public.expenses (household_id, description, amount, category_id, paid_by)
  values (pg_temp.id('h'), 'Sin splits', 5000, pg_temp.id('comida'), pg_temp.id('a'));
  perform pg_temp.check_deferred();
end;
$$;

create function pg_temp.try_expense_with_bad_splits()
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.expenses (household_id, description, amount, category_id, paid_by)
  values (pg_temp.id('h'), 'Splits trucados', 100000, pg_temp.id('comida'), pg_temp.id('a'))
  returning id into v_id;

  -- 50/50 declarado, pero 10.000 / 90.000 en montos.
  insert into public.expense_splits (expense_id, household_id, user_id, share_bp, amount)
  values
    (v_id, pg_temp.id('h'), pg_temp.id('a'), 5000, 10000),
    (v_id, pg_temp.id('h'), pg_temp.id('b'), 5000, 90000);
  perform pg_temp.check_deferred();
end;
$$;

select pg_temp.create_user('11111111-1111-1111-1111-111111111111', 'a@bullmilton.test', 'Ana');
select pg_temp.create_user('22222222-2222-2222-2222-222222222222', 'b@bullmilton.test', 'Beto');
select pg_temp.create_user('33333333-3333-3333-3333-333333333333', 'c@bullmilton.test', 'Carla');
select set_config('test.a', '11111111-1111-1111-1111-111111111111', true);
select set_config('test.b', '22222222-2222-2222-2222-222222222222', true);
select set_config('test.c', '33333333-3333-3333-3333-333333333333', true);

select pg_temp.login_as(pg_temp.id('a'));
select set_config('test.h', public.create_household('Casa')::text, true);
select set_config('test.code', (select code from public.create_invitation(pg_temp.id('h'))), true);
select pg_temp.login_as(pg_temp.id('b'));
select public.accept_invitation(current_setting('test.code'));
select pg_temp.login_as(pg_temp.id('c'));
select set_config('test.h2', public.create_household('Casa de Carla')::text, true);
reset role;

select set_config('test.vivienda', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Vivienda'), true);
select set_config('test.comida', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Comida'), true);
select set_config('test.trabajo', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Trabajo'), true);
select set_config('test.comida_c', (select id::text from public.categories where household_id = pg_temp.id('h2') and name = 'Comida'), true);

-- ---------------------------------------------------------------------------
-- Creación de gastos y reparto
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select set_config('test.e1', public.create_expense(
       pg_temp.id('h'), 'Arriendo', 1000000, pg_temp.id('vivienda'), pg_temp.id('a'))::text, true) $$,
  'A registra un gasto 50/50'
);

select results_eq(
  $$ select user_id, share_bp, amount from public.expense_splits where expense_id = pg_temp.id('e1') order by user_id $$,
  $$ values (pg_temp.id('a'), 5000, 500000::bigint), (pg_temp.id('b'), 5000, 500000::bigint) $$,
  '50/50 de 1.000.000: 500.000 cada uno'
);

select results_eq(
  $$ select created_by, updated_by, status, currency, paid_by
     from public.expenses where id = pg_temp.id('e1') $$,
  $$ values (pg_temp.id('a'), pg_temp.id('a'), 'active'::text, 'COP'::text, pg_temp.id('a')) $$,
  'El gasto guarda auditoría, estado activo y moneda del household'
);

select lives_ok(
  $$ select set_config('test.e2', public.create_expense(
       pg_temp.id('h'), 'Mercado', 100000, pg_temp.id('comida'), pg_temp.id('a'), 'percentage',
       jsonb_build_array(
         jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 7000),
         jsonb_build_object('user_id', pg_temp.id('b'), 'share_bp', 3000)))::text, true) $$,
  'A registra un gasto 70/30'
);

select results_eq(
  $$ select user_id, amount from public.expense_splits where expense_id = pg_temp.id('e2') order by user_id $$,
  $$ values (pg_temp.id('a'), 70000::bigint), (pg_temp.id('b'), 30000::bigint) $$,
  '70/30 de 100.000: 70.000 / 30.000'
);

select set_config('test.e3', public.create_expense(
  pg_temp.id('h'), 'Impar', 100001, pg_temp.id('comida'), pg_temp.id('b'))::text, true);

select results_eq(
  $$ select user_id, amount from public.expense_splits where expense_id = pg_temp.id('e3') order by user_id $$,
  $$ values (pg_temp.id('a'), 50001::bigint), (pg_temp.id('b'), 50000::bigint) $$,
  'Montos impares: el peso sobrante se asigna de forma determinista y la suma es exacta'
);

select set_config('test.e4', public.create_expense(
  pg_temp.id('h'), 'Tercios', 100, pg_temp.id('comida'), pg_temp.id('a'), 'percentage',
  jsonb_build_array(
    jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 3333),
    jsonb_build_object('user_id', pg_temp.id('b'), 'share_bp', 6667)))::text, true);

select is(
  (select sum(amount) from public.expense_splits where expense_id = pg_temp.id('e4')),
  100::numeric,
  'Porcentajes con decimales (33,33 / 66,67): la suma de splits es el monto exacto'
);

select throws_ok(
  $$ select public.create_expense(
       pg_temp.id('h'), 'Malo', 1000, pg_temp.id('comida'), pg_temp.id('a'), 'percentage',
       jsonb_build_array(
         jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 6000),
         jsonb_build_object('user_id', pg_temp.id('b'), 'share_bp', 3000))) $$,
  '23514',
  'split_must_total_100',
  'Porcentajes que no suman 100 % son rechazados'
);

select throws_ok(
  $$ select public.create_expense(pg_temp.id('h'), 'Cero', 0, pg_temp.id('comida'), pg_temp.id('a')) $$,
  '23514',
  null,
  'Monto 0 es rechazado'
);

select throws_ok(
  $$ select public.create_expense(pg_temp.id('h'), 'Pagó un externo', 1000, pg_temp.id('comida'), pg_temp.id('c')) $$,
  '23514',
  'user_not_active_member',
  'El pagador debe ser miembro del household'
);

select throws_ok(
  $$ select public.create_expense(pg_temp.id('h'), 'Categoría de ingreso', 1000, pg_temp.id('trabajo'), pg_temp.id('a')) $$,
  '23514',
  'invalid_category',
  'Un gasto no puede usar una categoría de ingreso'
);

-- ---------------------------------------------------------------------------
-- La base de datos impide splits inconsistentes por cualquier camino
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select pg_temp.try_expense_without_splits() $$,
  '23514',
  'invalid_expense_splits',
  'Un gasto insertado directamente sin splits no puede confirmarse'
);

select throws_ok(
  $$ select pg_temp.try_expense_with_bad_splits() $$,
  '23514',
  'invalid_expense_splits',
  'Splits cuyo monto no corresponde al porcentaje no pueden confirmarse'
);

-- ---------------------------------------------------------------------------
-- Edición, anulación y auditoría
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('b'));

select lives_ok(
  $$ select public.update_expense(
       pg_temp.id('e1'), 'Arriendo octubre', 1200000, pg_temp.id('vivienda'), pg_temp.id('a'), 'percentage',
       jsonb_build_array(
         jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 6000),
         jsonb_build_object('user_id', pg_temp.id('b'), 'share_bp', 4000))) $$,
  'B edita un gasto creado por A'
);

select lives_ok($$ select pg_temp.check_deferred() $$, 'La edición deja splits consistentes');

select results_eq(
  $$ select user_id, share_bp, amount from public.expense_splits where expense_id = pg_temp.id('e1') order by user_id $$,
  $$ values (pg_temp.id('a'), 6000, 720000::bigint), (pg_temp.id('b'), 4000, 480000::bigint) $$,
  'Los splits se recalculan al editar (60/40 de 1.200.000)'
);

select results_eq(
  $$ select created_by, updated_by from public.expenses where id = pg_temp.id('e1') $$,
  $$ values (pg_temp.id('a'), pg_temp.id('b')) $$,
  'La auditoría conserva el creador y registra quién modificó'
);

select throws_ok(
  $$ update public.expenses set created_by = pg_temp.id('b') where id = pg_temp.id('e1') $$,
  '42501',
  null,
  'created_by no es editable desde el cliente'
);

select throws_ok(
  $$ update public.expenses set household_id = pg_temp.id('h2') where id = pg_temp.id('e1') $$,
  '42501',
  null,
  'Un gasto no puede reasignarse a otro household'
);

select throws_ok(
  $$ delete from public.expenses where id = pg_temp.id('e1') $$,
  '42501',
  null,
  'Los gastos no se pueden borrar (solo anular)'
);

select lives_ok($$ select public.void_expense(pg_temp.id('e2')) $$, 'B anula un gasto');

select results_eq(
  $$ select status, voided_by from public.expenses where id = pg_temp.id('e2') $$,
  $$ values ('voided'::text, pg_temp.id('b')) $$,
  'El gasto anulado registra quién lo anuló'
);

select throws_ok(
  $$ update public.expenses set status = 'active' where id = pg_temp.id('e2') $$,
  'P0001',
  'record_voided',
  'Un gasto anulado no se puede reactivar ni editar'
);

-- ---------------------------------------------------------------------------
-- Aislamiento: C (otro household)
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.expenses where household_id = pg_temp.id('h')),
  0::bigint,
  'C no ve los gastos del household de A'
);

select is(
  (select count(*) from public.expense_splits where household_id = pg_temp.id('h')),
  0::bigint,
  'C no ve los splits del household de A'
);

select throws_ok(
  $$ select public.create_expense(pg_temp.id('h'), 'Intrusión', 1000, pg_temp.id('comida'), pg_temp.id('a')) $$,
  '42501',
  null,
  'C no puede crear gastos en el household de A'
);

select throws_ok(
  $$ select public.void_expense(pg_temp.id('e1')) $$,
  'P0002',
  'not_found',
  'C no puede anular gastos del household de A'
);

select pg_temp.attempt($$ update public.expenses set description = 'Hackeado' where id = pg_temp.id('e1') $$);

select throws_ok(
  $$ select public.create_expense(pg_temp.id('h2'), 'Categoría ajena', 1000, pg_temp.id('comida'), pg_temp.id('c')) $$,
  '23503',
  null,
  'C no puede usar categorías de otro household'
);

reset role;

select is(
  (select description from public.expenses where id = pg_temp.id('e1')),
  'Arriendo octubre',
  'El UPDATE de C sobre un gasto ajeno no tuvo efecto'
);

-- ---------------------------------------------------------------------------
-- Ingresos
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select public.create_income(pg_temp.id('h'), pg_temp.id('a'), 'Salario', 3000000, pg_temp.id('trabajo')) $$,
  'A registra un ingreso propio'
);

select throws_ok(
  $$ select public.create_income(pg_temp.id('h'), pg_temp.id('a'), 'Categoría de gasto', 1000, pg_temp.id('comida')) $$,
  '23514',
  'invalid_category',
  'Un ingreso no puede usar una categoría de gasto'
);

-- Ingresos compartidos y registro a nombre de otro: 05_incomes.test.sql.

select pg_temp.login_as(pg_temp.id('b'));

select is(
  (select count(*) from public.incomes where household_id = pg_temp.id('h')),
  1::bigint,
  'B ve los ingresos del household compartido'
);

-- ---------------------------------------------------------------------------
-- Transferencias
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.transfers (household_id, from_user, to_user, amount)
     values (pg_temp.id('h'), pg_temp.id('b'), pg_temp.id('a'), 300000) $$,
  'B registra una transferencia a A'
);

select throws_ok(
  $$ insert into public.transfers (household_id, from_user, to_user, amount)
     values (pg_temp.id('h'), pg_temp.id('b'), pg_temp.id('b'), 1000) $$,
  '23514',
  null,
  'Origen y destino deben ser distintos'
);

select throws_ok(
  $$ insert into public.transfers (household_id, from_user, to_user, amount)
     values (pg_temp.id('h'), pg_temp.id('b'), pg_temp.id('c'), 1000) $$,
  '23514',
  'user_not_active_member',
  'No se puede transferir a alguien fuera del household'
);

select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.transfers) + (select count(*) from public.incomes),
  0::bigint,
  'C no ve ingresos ni transferencias del household de A'
);

reset role;

select * from finish();
rollback;
