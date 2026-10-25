-- BULLMILTON · pgTAP · Pagos de tarjeta y presupuestos personales
--
-- Household H: A y B.  Household H2: C (externo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

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

create function pg_temp.cat(p_household text, p_name text)
returns uuid
language sql
as $$
  select id from public.categories where household_id = pg_temp.id(p_household) and name = p_name;
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

-- Ids de categorías guardados como superusuario (cada usuario solo ve las de su hogar).
select set_config('test.' || v.key, pg_temp.cat(v.house, v.name)::text, true)
from (values ('comida', 'h', 'Comida'), ('vivienda', 'h', 'Vivienda'), ('compras', 'h', 'Compras'),
             ('salud', 'h', 'Salud'), ('mesada', 'h', 'Mesada'), ('otros', 'h', 'Otros'),
             ('subs', 'h', 'Suscripciones'), ('salud2', 'h2', 'Salud')) as v (key, house, name);

-- ---------------------------------------------------------------------------
-- Gasto con varias categorías y tarjeta

-- ---------------------------------------------------------------------------
-- Pagos de tarjeta
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format($$ with i as (
              insert into public.card_payments (household_id, user_id, amount, notes)
              values (%L, %L, 60000, 'Mi parte de octubre') returning id)
            select set_config('test.p1', id::text, true) from i $$,
         pg_temp.id('h'), pg_temp.id('b')),
  'A registra un pago de tarjeta (la parte de B)'
);

select is(
  (select created_by from public.card_payments where id = pg_temp.id('p1')),
  pg_temp.id('a'),
  'El pago queda auditado con quien lo registró'
);

select lives_ok(
  format($$ update public.card_payments set status = 'voided' where id = %L $$, pg_temp.id('p1')),
  'Se puede anular un pago de tarjeta'
);

select throws_ok(
  format($$ update public.card_payments set amount = 1 where id = %L $$, pg_temp.id('p1')),
  'P0001',
  'record_voided',
  'Un pago anulado ya no se puede modificar'
);

select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.card_payments),
  0::bigint,
  'C no ve los pagos de tarjeta de otro hogar'
);

select throws_ok(
  format($$ insert into public.card_payments (household_id, user_id, amount)
            values (%L, %L, 1000) $$, pg_temp.id('h'), pg_temp.id('a')),
  '42501',
  null,
  'C no puede registrar pagos en otro hogar'
);

-- ---------------------------------------------------------------------------
-- Presupuestos: privados de quien los crea
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format($$ with i as (
              insert into public.budgets (household_id, name, kind, category_id, amount, period)
              values (%L, 'Comida', 'category', %L, 400000, 'month') returning id)
            select set_config('test.bcat', id::text, true) from i $$,
         pg_temp.id('h'), pg_temp.id('comida')),
  'A crea un presupuesto por categoría'
);

select lives_ok(
  format($$ with i as (
              insert into public.budgets (household_id, name, kind, amount, period)
              values (%L, 'Salidas', 'free', 100000, 'week') returning id)
            select set_config('test.bfree', id::text, true) from i $$,
         pg_temp.id('h')),
  'A crea un presupuesto libre semanal'
);

select is(
  (select user_id from public.budgets where id = pg_temp.id('bfree')),
  pg_temp.id('a'),
  'El presupuesto queda a nombre de quien lo crea'
);

select throws_ok(
  format($$ insert into public.budgets (household_id, name, kind, amount, period)
            values (%L, 'Sin categoría', 'category', 1000, 'month') $$, pg_temp.id('h')),
  '23514',
  null,
  'Un presupuesto por categoría exige categoría'
);

select throws_ok(
  format($$ insert into public.budgets (household_id, name, kind, category_id, amount, period)
            values (%L, 'Mesada', 'category', %L, 1000, 'month') $$,
         pg_temp.id('h'), pg_temp.id('mesada')),
  '23514',
  'invalid_category',
  'Un presupuesto no puede usar una categoría de ingreso'
);

select set_config('test.e1', public.create_expense(
  pg_temp.id('h'), 'Cine', 50000, pg_temp.id('comida'), pg_temp.id('a'))::text, true);

select lives_ok(
  format($$ select public.set_expense_budgets(%L, jsonb_build_array(%L)) $$,
         pg_temp.id('e1'), pg_temp.id('bfree')),
  'A cuenta un gasto en su presupuesto libre'
);

select throws_ok(
  format($$ select public.set_expense_budgets(%L, jsonb_build_array(%L)) $$,
         pg_temp.id('e1'), pg_temp.id('bcat')),
  '23514',
  'invalid_budget',
  'Solo los presupuestos libres reciben gastos a mano'
);

select pg_temp.login_as(pg_temp.id('b'));

select is(
  (select count(*) from public.budgets) + (select count(*) from public.budget_expenses),
  0::bigint,
  'B no ve los presupuestos de A ni sus gastos asignados'
);

-- RLS: para B estas filas no existen; se comprueba abajo como superusuario.
update public.budgets set amount = 1;
delete from public.budgets;

select throws_ok(
  format($$ insert into public.budgets (household_id, user_id, name, kind, amount, period)
            values (%L, %L, 'Falso', 'total', 1000, 'month') $$,
         pg_temp.id('h'), pg_temp.id('a')),
  '42501',
  null,
  'B no puede crear presupuestos a nombre de A'
);

select throws_ok(
  format($$ select public.set_expense_budgets(%L, jsonb_build_array(%L)) $$,
         pg_temp.id('e1'), pg_temp.id('bfree')),
  '23514',
  'invalid_budget',
  'B no puede usar el presupuesto de A'
);

select lives_ok(
  format($$ with i as (
              insert into public.budgets (household_id, name, kind, amount, period)
              values (%L, 'Lo mío', 'free', 80000, 'month') returning id)
            select public.set_expense_budgets(%L, jsonb_build_array(id)) from i $$,
         pg_temp.id('h'), pg_temp.id('e1')),
  'B cuenta el mismo gasto en un presupuesto suyo'
);

select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format($$ select public.set_expense_budgets(%L, '[]'::jsonb) $$, pg_temp.id('e1')),
  'A quita el gasto de sus presupuestos'
);

reset role;

select is(
  (select count(*) from public.budgets where user_id = pg_temp.id('a') and amount > 1),
  2::bigint,
  'B no pudo editar ni borrar los presupuestos de A'
);

select is(
  (select array_agg(user_id) from public.budget_expenses where expense_id = pg_temp.id('e1')),
  array[pg_temp.id('b')],
  'Quitarlo de los presupuestos de A no toca los de B'
);

select pg_temp.login_as(pg_temp.id('c'));

select throws_ok(
  format($$ insert into public.budgets (household_id, name, kind, amount, period)
            values (%L, 'Intruso', 'total', 1000, 'month') $$, pg_temp.id('h')),
  '42501',
  null,
  'C no puede crear presupuestos en otro hogar'
);

select * from finish();
rollback;
