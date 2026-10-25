-- BULLMILTON · pgTAP · Preferencias: gráfica inicial de Reportes y alertas de gasto
--
-- Household H: A y B.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

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

select pg_temp.create_user('11111111-1111-1111-1111-111111111111', 'a@bullmilton.test', 'Ana');
select pg_temp.create_user('22222222-2222-2222-2222-222222222222', 'b@bullmilton.test', 'Beto');
select set_config('test.a', '11111111-1111-1111-1111-111111111111', true);
select set_config('test.b', '22222222-2222-2222-2222-222222222222', true);

select pg_temp.login_as(pg_temp.id('a'));
select set_config('test.h', public.create_household('Casa')::text, true);
select set_config('test.code', (select code from public.create_invitation(pg_temp.id('h'))), true);
select pg_temp.login_as(pg_temp.id('b'));
select public.accept_invitation(current_setting('test.code'));
reset role;

-- ---------------------------------------------------------------------------
-- Valores por defecto y privilegios
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select report_chart, spend_alerts, spend_alert_threshold
     from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('income_expense'::text, true, 80::smallint) $$,
  'Un perfil nuevo empieza con Ingresos vs gastos y alertas al 80 %'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'report_chart', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'spend_alerts', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'spend_alert_threshold', 'UPDATE'),
  'authenticated puede actualizar las tres columnas'
);

select ok(
  not has_column_privilege('anon', 'public.profiles', 'report_chart', 'UPDATE')
  and not has_column_privilege('anon', 'public.profiles', 'spend_alert_threshold', 'UPDATE'),
  'anon no puede actualizarlas'
);

-- ---------------------------------------------------------------------------
-- A cambia sus preferencias
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ update public.profiles
     set report_chart = 'pace', spend_alerts = false, spend_alert_threshold = 90
     where id = pg_temp.id('a') $$,
  'A elige Ritmo del mes, apaga las alertas y sube el umbral'
);

select results_eq(
  $$ select report_chart, spend_alerts, spend_alert_threshold
     from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('pace'::text, false, 90::smallint) $$,
  'Los cambios quedan guardados'
);

select lives_ok(
  $$ update public.profiles set report_chart = 'compare' where id = pg_temp.id('a') $$,
  'Todas las vistas permitidas se aceptan (Comparar)'
);

select throws_ok(
  $$ update public.profiles set report_chart = 'pie' where id = pg_temp.id('a') $$,
  '23514', null, 'Vista desconocida: rechazada'
);
select throws_ok(
  $$ update public.profiles set spend_alert_threshold = 85 where id = pg_temp.id('a') $$,
  '23514', null, 'Umbral fuera de los permitidos: rechazado'
);
select throws_ok(
  $$ update public.profiles set spend_alert_threshold = null where id = pg_temp.id('a') $$,
  '23502', null, 'Umbral vacío: rechazado'
);

-- ---------------------------------------------------------------------------
-- B no toca las preferencias de A
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('b'));
select pg_temp.attempt($$ update public.profiles set report_chart = 'person', spend_alerts = true where id = pg_temp.id('a') $$);

select is(
  (select spend_alerts from public.profiles where id = pg_temp.id('b')),
  true,
  'B conserva sus propias preferencias'
);
reset role;

select results_eq(
  $$ select report_chart, spend_alerts from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('compare'::text, false) $$,
  'B no pudo cambiar las preferencias de A'
);

select * from finish();
rollback;
