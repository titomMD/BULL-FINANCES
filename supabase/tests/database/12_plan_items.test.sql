-- BULLMILTON · pgTAP · Plan del mes (privado de cada persona)
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

create function pg_temp.login_as(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@bullmilton.test', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@bullmilton.test', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.ha', public.create_household('Mis finanzas')::text, true);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select set_config('test.hb', public.create_household('Mis finanzas')::text, true);

-- A arma su plan
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount, starts_on, ends_on)
            values (%L, 'income', 'Fondo semestral', 2050000, '2026-07-01', '2026-12-31') $$,
         current_setting('test.ha')),
  'A crea un ingreso con rango de meses'
);

select lives_ok(
  format($$ insert into public.plan_items (household_id, kind, name, group_name, amount)
            values (%L, 'expense', 'iCloud', 'Tarjeta', 21000) $$,
         current_setting('test.ha')),
  'A crea un gasto agrupado'
);

select is(
  (select user_id from public.plan_items where name = 'iCloud'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'La línea queda a nombre de quien la crea'
);

select throws_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount) values (%L, 'income', 'Cero', 0) $$,
         current_setting('test.ha')),
  '23514', null, 'No se aceptan montos de 0'
);

select throws_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount, starts_on, ends_on)
            values (%L, 'income', 'Al revés', 1000, '2026-12-01', '2026-07-01') $$,
         current_setting('test.ha')),
  '23514', null, 'El último mes no puede ser anterior al primero'
);

select throws_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount) values (%L, 'otro', 'x', 1000) $$,
         current_setting('test.ha')),
  '23514', null, 'Solo existen los tipos ingreso, gasto y ahorro'
);

-- B no ve ni toca lo de A
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.plan_items), 0, 'B no ve el plan de A');

select throws_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount, user_id)
            values (%L, 'income', 'Falso', 1000, '11111111-1111-1111-1111-111111111111') $$,
         current_setting('test.hb')),
  null, null, 'B no puede crear líneas a nombre de A'
);

delete from public.plan_items;
reset role;
select is((select count(*)::int from public.plan_items), 2, 'B no puede borrar las líneas de A');

-- A sí puede borrar las suyas
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
delete from public.plan_items where name = 'iCloud';
reset role;
select is((select count(*)::int from public.plan_items), 1, 'A borra una de sus líneas');

select * from finish();
rollback;
