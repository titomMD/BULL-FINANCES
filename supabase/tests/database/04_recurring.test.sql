-- BULLMILTON · pgTAP · Gastos recurrentes (spec §14-§15, FASE 9)
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

create function pg_temp.check_deferred()
returns void
language plpgsql
as $$
begin
  set constraints all immediate;
  set constraints all deferred;
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
select public.create_household('Casa de Carla');
reset role;

select set_config('test.vivienda', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Vivienda'), true);

-- ---------------------------------------------------------------------------
-- Próxima fecha
-- ---------------------------------------------------------------------------
select is(private.next_occurrence('2026-01-31', 'monthly', 31), '2026-02-28'::date,
  'Mensual del 31: en febrero cae el último día');
select is(private.next_occurrence('2026-02-28', 'monthly', 31), '2026-03-31'::date,
  'Y vuelve al 31 en marzo (día de anclaje)');
select is(private.next_occurrence('2026-11-15', 'quarterly', 15), '2027-02-15'::date,
  'Trimestral cruza de año');

-- ---------------------------------------------------------------------------
-- Plantillas
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select set_config('test.r1', public.create_recurring_expense(
       pg_temp.id('h'), 'Arriendo', 1000000, 'monthly', private.today_bogota() - 1,
       pg_temp.id('vivienda'), pg_temp.id('a'))::text, true) $$,
  'A crea una plantilla mensual 50/50 vencida ayer'
);

select lives_ok($$ select pg_temp.check_deferred() $$, 'La plantilla tiene splits consistentes');

select results_eq(
  $$ select user_id, share_bp from public.recurring_expense_splits
     where recurring_expense_id = pg_temp.id('r1') order by user_id $$,
  $$ values (pg_temp.id('a'), 5000), (pg_temp.id('b'), 5000) $$,
  'La división predeterminada se guarda en puntos básicos'
);

select lives_ok(
  $$ select set_config('test.e1', public.generate_recurring_expense(pg_temp.id('r1'), 1050000)::text, true) $$,
  'B o A confirman la ocurrencia vencida con un monto ajustado'
);

select results_eq(
  $$ select amount, recurring_expense_id, recurring_due_date, date
     from public.expenses where id = pg_temp.id('e1') $$,
  $$ values (1050000::bigint, pg_temp.id('r1'), private.today_bogota() - 1, private.today_bogota() - 1) $$,
  'Se crea el gasto vinculado a la plantilla y a su fecha'
);

select results_eq(
  $$ select user_id, amount from public.expense_splits where expense_id = pg_temp.id('e1') order by user_id $$,
  $$ values (pg_temp.id('a'), 525000::bigint), (pg_temp.id('b'), 525000::bigint) $$,
  'El gasto generado usa la división de la plantilla'
);

select is(
  (select next_due_date from public.recurring_expenses where id = pg_temp.id('r1')),
  private.next_occurrence(private.today_bogota() - 1, 'monthly',
    extract(day from private.today_bogota() - 1)::int),
  'La próxima fecha avanza un mes'
);

select throws_ok(
  $$ select public.generate_recurring_expense(pg_temp.id('r1')) $$,
  'P0001',
  'recurring_not_due',
  'No se puede generar una ocurrencia que aún no vence'
);

select lives_ok($$ select pg_temp.check_deferred() $$, 'Todo queda consistente al confirmar');

-- ---------------------------------------------------------------------------
-- Saltar, pausar, aislamiento y borrado
-- ---------------------------------------------------------------------------
select set_config('test.r2', public.create_recurring_expense(
  pg_temp.id('h'), 'Netflix', 44900, 'monthly', private.today_bogota(),
  pg_temp.id('vivienda'), pg_temp.id('b'))::text, true);

select public.skip_recurring_expense(pg_temp.id('r2'));

select is(
  (select count(*) from public.expenses where recurring_expense_id = pg_temp.id('r2')),
  0::bigint,
  'Saltar una ocurrencia no crea gasto'
);

select public.update_recurring_expense(
  pg_temp.id('r2'), 'Netflix', 44900, 'monthly', private.today_bogota(),
  pg_temp.id('vivienda'), pg_temp.id('b'), p_active => false);

select throws_ok(
  $$ select public.generate_recurring_expense(pg_temp.id('r2')) $$,
  'P0001',
  'recurring_inactive',
  'Una plantilla pausada no genera gastos'
);

select pg_temp.login_as(pg_temp.id('c'));

select is(
  (select count(*) from public.recurring_expenses where household_id = pg_temp.id('h')),
  0::bigint,
  'C no ve las plantillas del household de A'
);

select throws_ok(
  $$ select public.generate_recurring_expense(pg_temp.id('r1')) $$,
  'P0002',
  'not_found',
  'C no puede generar gastos con plantillas ajenas'
);

select pg_temp.login_as(pg_temp.id('a'));
delete from public.recurring_expenses where id = pg_temp.id('r1');

select results_eq(
  $$ select recurring_expense_id, status from public.expenses where id = pg_temp.id('e1') $$,
  $$ values (null::uuid, 'active'::text) $$,
  'Borrar la plantilla conserva el gasto generado'
);

reset role;

select * from finish();
rollback;
