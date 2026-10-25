-- BULLMILTON · pgTAP · Ingresos compartidos, registro a nombre de otro y apariencia
--
-- Household H: A y B.  Household H2: C (externo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

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

create function pg_temp.check_deferred()
returns void
language plpgsql
as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;

-- Escrituras directas (sin la RPC) seguidas de la comprobación de commit.
create function pg_temp.try_income_without_splits()
returns void
language plpgsql
as $$
begin
  insert into public.incomes (household_id, user_id, source, amount)
  values (pg_temp.id('h'), pg_temp.id('a'), 'Sin splits', 5000);
  perform pg_temp.check_deferred();
end;
$$;

create function pg_temp.try_income_with_bad_splits()
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.incomes (household_id, user_id, source, amount)
  values (pg_temp.id('h'), pg_temp.id('a'), 'Splits trucados', 100000)
  returning id into v_id;

  insert into public.income_splits (income_id, household_id, user_id, share_bp, amount)
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

select set_config('test.mesada', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Mesada'), true);

-- ---------------------------------------------------------------------------
-- Ingreso de una persona (por defecto: 100 % de quien lo recibió)
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select set_config('test.i1', public.create_income(
       pg_temp.id('h'), pg_temp.id('a'), 'Salario', 3000000)::text, true) $$,
  'A registra un ingreso propio'
);

select results_eq(
  $$ select user_id, share_bp, amount from public.income_splits where income_id = pg_temp.id('i1') $$,
  $$ values (pg_temp.id('a'), 10000, 3000000::bigint) $$,
  'Sin reparto, el ingreso es 100 % de quien lo recibió'
);

select lives_ok($$ select pg_temp.check_deferred() $$, 'El ingreso tiene splits consistentes');

-- ---------------------------------------------------------------------------
-- Registrar a nombre de otro
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.i2', public.create_income(
       pg_temp.id('h'), pg_temp.id('b'), 'Salario de Beto', 2000000)::text, true) $$,
  'A registra un ingreso a nombre de B'
);

select results_eq(
  $$ select i.user_id, i.created_by, s.user_id, s.amount
     from public.incomes i join public.income_splits s on s.income_id = i.id
     where i.id = pg_temp.id('i2') $$,
  $$ values (pg_temp.id('b'), pg_temp.id('a'), pg_temp.id('b'), 2000000::bigint) $$,
  'El ingreso es de B y la auditoría dice que lo registró A'
);

select throws_ok(
  $$ select public.create_income(pg_temp.id('h'), pg_temp.id('c'), 'De Carla', 1000) $$,
  '23514',
  'user_not_active_member',
  'No se puede registrar un ingreso de alguien fuera del household'
);

select pg_temp.login_as(pg_temp.id('b'));

select lives_ok(
  $$ select public.update_income(pg_temp.id('i1'), pg_temp.id('a'), 'Salario octubre', 3100000) $$,
  'B edita un ingreso de A'
);

select results_eq(
  $$ select s.amount, i.updated_by from public.incomes i
     join public.income_splits s on s.income_id = i.id where i.id = pg_temp.id('i1') $$,
  $$ values (3100000::bigint, pg_temp.id('b')) $$,
  'La edición reemplaza el reparto y registra quién editó'
);

-- ---------------------------------------------------------------------------
-- Ingresos compartidos
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select set_config('test.i3', public.create_income(
       pg_temp.id('h'), pg_temp.id('a'), 'Mesada papás', 1000001, pg_temp.id('mesada'), 'equal',
       jsonb_build_array(pg_temp.id('a'), pg_temp.id('b')))::text, true) $$,
  'A registra un ingreso compartido en partes iguales'
);

select results_eq(
  $$ select user_id, share_bp, amount from public.income_splits where income_id = pg_temp.id('i3') order by user_id $$,
  $$ values (pg_temp.id('a'), 5000, 500001::bigint), (pg_temp.id('b'), 5000, 500000::bigint) $$,
  '1.000.001 a partes iguales: el peso sobrante va al primero por user_id'
);

select lives_ok(
  $$ select set_config('test.i4', public.create_income(
       pg_temp.id('h'), pg_temp.id('b'), 'Beca', 900000, null, 'percentage',
       jsonb_build_array(
         jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 3000),
         jsonb_build_object('user_id', pg_temp.id('b'), 'share_bp', 7000)))::text, true) $$,
  'Ingreso compartido por porcentaje 30/70'
);

select results_eq(
  $$ select user_id, amount from public.income_splits where income_id = pg_temp.id('i4') order by user_id $$,
  $$ values (pg_temp.id('a'), 270000::bigint), (pg_temp.id('b'), 630000::bigint) $$,
  '30/70 de 900.000: 270.000 y 630.000'
);

select throws_ok(
  $$ select public.create_income(pg_temp.id('h'), pg_temp.id('a'), 'Mal repartido', 1000, null, 'percentage',
       jsonb_build_array(jsonb_build_object('user_id', pg_temp.id('a'), 'share_bp', 6000))) $$,
  '23514',
  'split_must_total_100',
  'Los porcentajes deben sumar 100 %'
);

select lives_ok($$ select pg_temp.check_deferred() $$, 'Todos los repartos creados son consistentes');

select throws_ok(
  $$ select pg_temp.try_income_without_splits() $$,
  '23514',
  'invalid_income_splits',
  'Un ingreso sin reparto no llega al commit'
);

select throws_ok(
  $$ select pg_temp.try_income_with_bad_splits() $$,
  '23514',
  'invalid_income_splits',
  'Un reparto que no cuadra con el monto no llega al commit'
);

-- ---------------------------------------------------------------------------
-- Anulación
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.void_income(pg_temp.id('i4')) $$, 'A anula un ingreso de B');

select throws_ok(
  $$ select public.update_income(pg_temp.id('i4'), pg_temp.id('b'), 'Beca', 1, null) $$,
  'P0001',
  'record_voided',
  'Un ingreso anulado no se puede editar'
);

-- ---------------------------------------------------------------------------
-- Usuario externo
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.income_splits),
  0::bigint,
  'C no ve repartos de ingresos de otro household'
);

select throws_ok(
  $$ select public.update_income(pg_temp.id('i1'), pg_temp.id('c'), 'Robado', 1) $$,
  'P0002',
  'not_found',
  'C no puede editar un ingreso de otro household'
);

select throws_ok(
  $$ select public.create_income(pg_temp.id('h'), pg_temp.id('a'), 'Intruso', 1000) $$,
  '42501',
  null,
  'C no puede crear ingresos en el household de A'
);

-- ---------------------------------------------------------------------------
-- Apariencia
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ update public.profiles set theme = 'papel', font = 'geist' where id = pg_temp.id('a') $$,
  'A cambia su tema y su fuente'
);

select throws_ok(
  $$ update public.profiles set theme = 'neon' where id = pg_temp.id('a') $$,
  '23514',
  null,
  'Solo se aceptan temas conocidos'
);

select pg_temp.attempt($$ update public.profiles set theme = 'vino' where id = pg_temp.id('b') $$);
reset role;

select is(
  (select theme from public.profiles where id = pg_temp.id('b')),
  'bullmilton',
  'A no puede cambiar la apariencia de B'
);

select * from finish();
rollback;
