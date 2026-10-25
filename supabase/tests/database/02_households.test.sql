-- BULLMILTON · pgTAP · Households, invitaciones y aislamiento entre households (spec §28-§29)
--
-- Personas:
--   A (owner del household "Casa"), B (pareja, se une por invitación),
--   C (externo con su propio household), D (sin household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- ---------------------------------------------------------------------------
-- Helpers (solo viven en esta transacción)
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

select pg_temp.create_user('11111111-1111-1111-1111-111111111111', 'a@bullmilton.test', 'Ana');
select pg_temp.create_user('22222222-2222-2222-2222-222222222222', 'b@bullmilton.test', 'Beto');
select pg_temp.create_user('33333333-3333-3333-3333-333333333333', 'c@bullmilton.test', 'Carla');
select pg_temp.create_user('44444444-4444-4444-4444-444444444444', 'd@bullmilton.test', '');

select set_config('test.a', '11111111-1111-1111-1111-111111111111', true);
select set_config('test.b', '22222222-2222-2222-2222-222222222222', true);
select set_config('test.c', '33333333-3333-3333-3333-333333333333', true);
select set_config('test.d', '44444444-4444-4444-4444-444444444444', true);

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles where id in (pg_temp.id('a'), pg_temp.id('b'), pg_temp.id('c'), pg_temp.id('d'))),
  4::bigint,
  'Registrarse crea el perfil automáticamente'
);

select is(
  (select display_name from public.profiles where id = pg_temp.id('d')),
  'd',
  'Sin display_name, el perfil usa la parte local del email'
);

-- ---------------------------------------------------------------------------
-- A crea su household
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ select set_config('test.hid', public.create_household('  Casa  ')::text, true) $$,
  'A crea un household'
);

select is(
  (select name from public.households where id = pg_temp.id('hid')),
  'Casa',
  'A ve su household (nombre normalizado)'
);

select results_eq(
  $$ select user_id, role from public.household_members where household_id = pg_temp.id('hid') $$,
  $$ values (pg_temp.id('a'), 'owner'::text) $$,
  'A es owner y único miembro'
);

select is(
  (select count(*) from public.categories where household_id = pg_temp.id('hid')),
  15::bigint,
  'El household nace con 10 categorías de gasto y 5 de ingreso'
);

select throws_ok(
  $$ select public.create_household('Otra casa') $$,
  'P0001',
  'already_in_household',
  'Un usuario no puede tener dos households activos'
);

select lives_ok(
  $$ select set_config('test.code', (select code from public.create_invitation(pg_temp.id('hid'))), true) $$,
  'A genera un código de invitación'
);

select matches(
  current_setting('test.code'),
  '^[A-HJ-NP-Z2-9]{10}$',
  'El código tiene 10 caracteres sin ambigüedades'
);

-- ---------------------------------------------------------------------------
-- C (externo) tiene su propio household y no puede ver ni tocar el de A
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('c'));
select set_config('test.hid_c', public.create_household('Casa de Carla')::text, true);

select is(
  (select count(*) from public.households where id = pg_temp.id('hid')),
  0::bigint,
  'C no ve el household de A'
);

select is(
  (select count(*) from public.household_members where household_id = pg_temp.id('hid')),
  0::bigint,
  'C no ve los miembros del household de A'
);

select is(
  (select count(*) from public.invitations where household_id = pg_temp.id('hid')),
  0::bigint,
  'C no ve las invitaciones del household de A'
);

select is(
  (select count(*) from public.categories where household_id = pg_temp.id('hid')),
  0::bigint,
  'C no ve las categorías del household de A'
);

select is(
  (select count(*) from public.profiles where id = pg_temp.id('a')),
  0::bigint,
  'C no ve el perfil de A'
);

select throws_ok(
  $$ select public.create_invitation(pg_temp.id('hid')) $$,
  '42501',
  'forbidden',
  'C no puede generar invitaciones para el household de A'
);

select pg_temp.attempt($$ update public.households set name = 'Hackeado' where id = pg_temp.id('hid') $$);

select throws_ok(
  $$ insert into public.household_members (household_id, user_id) values (pg_temp.id('hid'), pg_temp.id('c')) $$,
  '42501',
  null,
  'C no puede insertarse directamente como miembro'
);

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.code')) $$,
  'P0001',
  'already_in_household',
  'C no puede aceptar una invitación teniendo ya un household'
);

reset role;

select is(
  (select name from public.households where id = pg_temp.id('hid')),
  'Casa',
  'El UPDATE de C sobre el household de A no tuvo efecto'
);

-- ---------------------------------------------------------------------------
-- B acepta la invitación
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('d'));

select throws_ok(
  $$ select public.accept_invitation('ZZZZZZZZZZ') $$,
  'P0001',
  'invalid_invitation',
  'Un código inexistente es rechazado'
);

select pg_temp.login_as(pg_temp.id('b'));

select is(
  public.accept_invitation(lower(current_setting('test.code'))),
  pg_temp.id('hid'),
  'B acepta la invitación (sin importar mayúsculas)'
);

select is(
  (select count(*) from public.household_members where household_id = pg_temp.id('hid') and left_at is null),
  2::bigint,
  'B ve a los dos miembros del household'
);

select is(
  (select display_name from public.profiles where id = pg_temp.id('a')),
  'Ana',
  'B ve el perfil de A'
);

select pg_temp.login_as(pg_temp.id('d'));

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.code')) $$,
  'P0001',
  'invalid_invitation',
  'Un código ya usado es rechazado'
);

reset role;

insert into public.invitations (household_id, created_by, code, created_at, expires_at)
values (pg_temp.id('hid'), pg_temp.id('a'), 'EXPRD23456', now() - interval '8 days', now() - interval '1 day');

select pg_temp.login_as(pg_temp.id('d'));

select throws_ok(
  $$ select public.accept_invitation('EXPRD23456') $$,
  'P0001',
  'invalid_invitation',
  'Un código vencido es rechazado'
);

-- ---------------------------------------------------------------------------
-- Escrituras protegidas
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select throws_ok(
  $$ update public.households set currency = 'USD' where id = pg_temp.id('hid') $$,
  '42501',
  null,
  'La moneda del household no es editable desde el cliente'
);

select throws_ok(
  $$ insert into public.households (name) values ('Directo') $$,
  '42501',
  null,
  'No se pueden crear households sin la RPC'
);

-- ---------------------------------------------------------------------------
-- Abandonar
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('b'));
select public.leave_household(pg_temp.id('hid'));

select is(
  (select count(*) from public.households where id = pg_temp.id('hid')),
  0::bigint,
  'Tras abandonar, B ya no ve el household'
);

select pg_temp.login_as(pg_temp.id('a'));

select is(
  (select display_name from public.profiles where id = pg_temp.id('b')),
  'Beto',
  'A sigue viendo el perfil de B en el historial'
);

-- B vuelve con una invitación nueva y A se va: B hereda el rol de owner.
select set_config('test.code2', (select code from public.create_invitation(pg_temp.id('hid'))), true);
select pg_temp.login_as(pg_temp.id('b'));
select public.accept_invitation(current_setting('test.code2'));
select pg_temp.login_as(pg_temp.id('a'));
select public.leave_household(pg_temp.id('hid'));
select pg_temp.login_as(pg_temp.id('b'));

select is(
  (select role from public.household_members where household_id = pg_temp.id('hid') and user_id = pg_temp.id('b')),
  'owner',
  'Si el owner se va, el miembro activo más antiguo pasa a ser owner'
);

reset role;

select * from finish();
rollback;
