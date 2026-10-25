-- BULLMILTON · pgTAP · Dinero personal (privado de cada persona)
--
-- Household H: A y B.  Household H2: C (externo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

select set_config('test.comida',
  (select id from public.categories where household_id = pg_temp.id('h') and name = 'Comida')::text, true);
select set_config('test.mesada',
  (select id from public.categories where household_id = pg_temp.id('h') and name = 'Mesada')::text, true);

-- ---------------------------------------------------------------------------
-- A registra su dinero personal
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format($$ with i as (
              insert into public.personal_movements (household_id, kind, description, amount, category_id)
              values (%L, 'income', 'Trabajo extra', 500000, %L) returning id)
            select set_config('test.i1', id::text, true) from i $$,
         pg_temp.id('h'), pg_temp.id('mesada')),
  'A registra un ingreso personal'
);

select lives_ok(
  format($$ with i as (
              insert into public.personal_movements (household_id, kind, description, amount, category_id)
              values (%L, 'expense', 'Almuerzo', 30000, %L) returning id)
            select set_config('test.g1', id::text, true) from i $$,
         pg_temp.id('h'), pg_temp.id('comida')),
  'A registra un gasto personal'
);

select is(
  (select user_id from public.personal_movements where id = pg_temp.id('i1')),
  pg_temp.id('a'),
  'El movimiento queda a nombre de quien lo registra'
);

select is(
  (select created_by from public.personal_movements where id = pg_temp.id('g1')),
  pg_temp.id('a'),
  'El movimiento queda auditado'
);

select throws_ok(
  format($$ insert into public.personal_movements (household_id, kind, description, amount, category_id)
            values (%L, 'expense', 'Mal', 1000, %L) $$, pg_temp.id('h'), pg_temp.id('mesada')),
  '23514',
  'invalid_category',
  'Un gasto personal no acepta una categoría de ingreso'
);

select throws_ok(
  format($$ insert into public.personal_movements (household_id, kind, description, amount)
            values (%L, 'expense', 'Gratis', 0) $$, pg_temp.id('h')),
  '23514',
  null,
  'El monto debe ser mayor que cero'
);

select lives_ok(
  format($$ update public.personal_movements set amount = 35000 where id = %L $$, pg_temp.id('g1')),
  'A edita su gasto personal'
);

-- ---------------------------------------------------------------------------
-- B no ve ni toca lo personal de A
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('b'));

select is(
  (select count(*) from public.personal_movements),
  0::bigint,
  'B no ve el dinero personal de A'
);

select throws_ok(
  format($$ insert into public.personal_movements (household_id, user_id, kind, description, amount)
            values (%L, %L, 'income', 'Falso', 1000) $$, pg_temp.id('h'), pg_temp.id('a')),
  '42501',
  null,
  'B no puede registrar dinero personal a nombre de A'
);

update public.personal_movements set amount = 1 where id = pg_temp.id('g1');
update public.personal_movements set status = 'voided' where id = pg_temp.id('i1');

select throws_ok(
  format($$ delete from public.personal_movements where id = %L $$, pg_temp.id('g1')),
  '42501',
  null,
  'Nadie puede borrar movimientos personales (se anulan)'
);

reset role;

select is(
  (select array_agg(amount order by amount) from public.personal_movements
    where user_id = pg_temp.id('a') and status = 'active'),
  array[35000::bigint, 500000::bigint],
  'B no pudo editar ni anular lo personal de A'
);

-- ---------------------------------------------------------------------------
-- No se mezcla con el hogar
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.incomes where household_id = pg_temp.id('h'))
    + (select count(*) from public.expenses where household_id = pg_temp.id('h')),
  0::bigint,
  'Lo personal no crea ingresos ni gastos del hogar'
);

-- ---------------------------------------------------------------------------
-- Anulación
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format($$ update public.personal_movements set status = 'voided' where id = %L $$, pg_temp.id('g1')),
  'A anula su gasto personal'
);

select throws_ok(
  format($$ update public.personal_movements set amount = 1 where id = %L $$, pg_temp.id('g1')),
  'P0001',
  'record_voided',
  'Un movimiento anulado ya no se puede modificar'
);

-- ---------------------------------------------------------------------------
-- Otro hogar
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.personal_movements),
  0::bigint,
  'C no ve el dinero personal de otro hogar'
);

select throws_ok(
  format($$ insert into public.personal_movements (household_id, kind, description, amount)
            values (%L, 'income', 'Intruso', 1000) $$, pg_temp.id('h')),
  '42501',
  null,
  'C no puede registrar dinero personal en otro hogar'
);

select * from finish();
rollback;
