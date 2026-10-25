-- BULLMILTON · pgTAP · Varias categorías por gasto y "pagado con tarjeta"
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
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  format(
    $$ select set_config('test.e1', public.create_expense(
         %L, 'Mercado y aseo', 120000, %L, %L, 'equal', null, null, null,
         jsonb_build_array(%L, %L, %L, %L), true)::text, true) $$,
    pg_temp.id('h'), pg_temp.id('comida'), pg_temp.id('a'),
    pg_temp.id('vivienda'), pg_temp.id('compras'),
    pg_temp.id('compras'), pg_temp.id('comida')),
  'A registra un gasto con categorías adicionales, pagado con tarjeta'
);

select results_eq(
  $$ select c.name from public.expense_categories ec
     join public.categories c on c.id = ec.category_id
     where ec.expense_id = pg_temp.id('e1') order by c.name $$,
  $$ values ('Compras'::text), ('Vivienda'::text) $$,
  'Se guardan las adicionales sin repetir y sin duplicar la principal'
);

select is(
  (select paid_with_card from public.expenses where id = pg_temp.id('e1')),
  true,
  'El gasto queda marcado como pagado con tarjeta'
);

select set_config('test.e0', public.create_expense(
  pg_temp.id('h'), 'Sin tarjeta', 1000, pg_temp.id('otros'), pg_temp.id('a'))::text, true);

select is(
  (select paid_with_card from public.expenses where id = pg_temp.id('e0')),
  false,
  'Las llamadas de antes (sin los parámetros nuevos) siguen funcionando, sin tarjeta'
);

select pg_temp.login_as(pg_temp.id('b'));

select lives_ok(
  format(
    $$ select public.update_expense(%L, 'Mercado', 120000, %L, %L, 'equal', null, null, null,
         jsonb_build_array(%L), false) $$,
    pg_temp.id('e1'), pg_temp.id('comida'), pg_temp.id('a'), pg_temp.id('salud')),
  'B edita el gasto: cambia categorías y quita la tarjeta'
);

select results_eq(
  $$ select c.name, e.paid_with_card from public.expense_categories ec
     join public.categories c on c.id = ec.category_id
     join public.expenses e on e.id = ec.expense_id
     where ec.expense_id = pg_temp.id('e1') $$,
  $$ values ('Salud'::text, false) $$,
  'La edición reemplaza las categorías adicionales y el marcador'
);

-- ---------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$ select public.create_expense(%L, 'Raro', 1000, %L, %L, 'equal', null, null, null,
         jsonb_build_array(%L)) $$,
    pg_temp.id('h'), pg_temp.id('comida'), pg_temp.id('b'), pg_temp.id('mesada')),
  '23514',
  'invalid_category',
  'Una categoría de ingreso no puede ser adicional de un gasto'
);

select throws_ok(
  format(
    $$ select public.create_expense(%L, 'Ajena', 1000, %L, %L, 'equal', null, null, null,
         jsonb_build_array(%L)) $$,
    pg_temp.id('h'), pg_temp.id('comida'), pg_temp.id('b'), pg_temp.id('salud2')),
  '23503',
  null,
  'Una categoría de otro hogar no se puede usar'
);

select throws_ok(
  format(
    $$ select public.create_expense(%L, 'Muchas', 1000, %L, %L, 'equal', null, null, null,
         (select jsonb_agg(id) from public.categories where household_id = %L and kind = 'expense')) $$,
    pg_temp.id('h'), pg_temp.id('comida'), pg_temp.id('b'), pg_temp.id('h')),
  '23514',
  'too_many_categories',
  'Máximo cinco categorías adicionales'
);

select throws_ok(
  format($$ delete from public.categories where id = %L $$, pg_temp.id('salud')),
  '23503',
  null,
  'Una categoría usada como adicional no se puede borrar (se archiva)'
);

select lives_ok(
  $$ select public.void_expense(pg_temp.id('e1')) $$,
  'Se anula el gasto'
);

select throws_ok(
  format($$ insert into public.expense_categories (expense_id, household_id, category_id)
            values (%L, %L, %L) $$, pg_temp.id('e1'), pg_temp.id('h'), pg_temp.id('compras')),
  'P0001',
  'record_voided',
  'Las categorías de un gasto anulado son de solo lectura'
);

-- ---------------------------------------------------------------------------
-- Recurrente con tarjeta
-- ---------------------------------------------------------------------------
select lives_ok(
  format(
    $$ select set_config('test.r1', public.create_recurring_expense(
         %L, 'Netflix', 44900, 'monthly', private.today_bogota(), %L, %L,
         'equal', null, null, true)::text, true) $$,
    pg_temp.id('h'), pg_temp.id('subs'), pg_temp.id('b')),
  'B crea un recurrente pagado con tarjeta'
);

select set_config('test.g1', public.generate_recurring_expense(pg_temp.id('r1'))::text, true);

select is(
  (select paid_with_card from public.expenses where id = pg_temp.id('g1')),
  true,
  'El gasto generado hereda el marcador de tarjeta'
);

-- ---------------------------------------------------------------------------
-- Usuario externo
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.expense_categories),
  0::bigint,
  'C no ve las categorías de gastos de otro hogar'
);

select throws_ok(
  format($$ insert into public.expense_categories (expense_id, household_id, category_id)
            values (%L, %L, %L) $$, pg_temp.id('e1'), pg_temp.id('h'), pg_temp.id('compras')),
  '42501',
  null,
  'C no puede añadir categorías a gastos de otro hogar'
);

select * from finish();
rollback;
