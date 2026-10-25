-- BULLMILTON · pgTAP · Personalización: columnas de apariencia, color por persona y de categoría
--
-- Household H: A y B.  Household H2: C (externo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

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

select set_config('test.cat', (select id::text from public.categories where household_id = pg_temp.id('h') and name = 'Comida'), true);

-- ---------------------------------------------------------------------------
-- Valores por defecto
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select mode, accent, person_color, density, text_size, corners, motion, private_mode
     from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('dark'::text, 'theme'::text, null::text, 'comoda'::text, 'normal'::text,
             'redondeadas'::text, 'sistema'::text, false) $$,
  'Un perfil nuevo empieza con la apariencia por defecto (Bullmilton oscuro)'
);

-- ---------------------------------------------------------------------------
-- A cambia su apariencia
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('a'));

select lives_ok(
  $$ update public.profiles
     set mode = 'system', accent = 'violeta', density = 'compacta', text_size = 'muy_grande',
         corners = 'rectas', motion = 'reducido', private_mode = true
     where id = pg_temp.id('a') $$,
  'A guarda modo, acento, densidad, texto, esquinas, movimiento y modo privado'
);

select results_eq(
  $$ select mode, accent, density, text_size, corners, motion, private_mode
     from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('system'::text, 'violeta'::text, 'compacta'::text, 'muy_grande'::text,
             'rectas'::text, 'reducido'::text, true) $$,
  'Los cambios quedan guardados'
);

select throws_ok($$ update public.profiles set mode = 'sepia' where id = pg_temp.id('a') $$,
  '23514', null, 'Modo desconocido: rechazado');
select throws_ok($$ update public.profiles set accent = '#ff00ff' where id = pg_temp.id('a') $$,
  '23514', null, 'Acento fuera de la paleta: rechazado (nada de HEX sueltos)');
select throws_ok($$ update public.profiles set density = 'apretada' where id = pg_temp.id('a') $$,
  '23514', null, 'Densidad desconocida: rechazada');
select throws_ok($$ update public.profiles set text_size = 'enorme' where id = pg_temp.id('a') $$,
  '23514', null, 'Tamaño de texto desconocido: rechazado');
select throws_ok($$ update public.profiles set corners = 'circulares' where id = pg_temp.id('a') $$,
  '23514', null, 'Esquinas desconocidas: rechazadas');
select throws_ok($$ update public.profiles set motion = 'nunca' where id = pg_temp.id('a') $$,
  '23514', null, 'Movimiento desconocido: rechazado');
select throws_ok($$ update public.profiles set person_color = 'naranja' where id = pg_temp.id('a') $$,
  '23514', null, 'Color de persona fuera de la paleta curada (naranja se confunde con el rojo): rechazado');

-- ---------------------------------------------------------------------------
-- Color por persona: único dentro del hogar, visible para el otro
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.profiles set person_color = 'azul' where id = pg_temp.id('a') $$,
  'A elige azul'
);

select pg_temp.login_as(pg_temp.id('b'));

select is(
  (select person_color from public.profiles where id = pg_temp.id('a')),
  'azul',
  'B ve el color de A'
);

select throws_ok(
  $$ update public.profiles set person_color = 'azul' where id = pg_temp.id('b') $$,
  '23505',
  'person_color_taken',
  'B no puede elegir el mismo color que A'
);

select lives_ok(
  $$ update public.profiles set person_color = 'rosa' where id = pg_temp.id('b') $$,
  'B elige otro color'
);

select pg_temp.attempt($$ update public.profiles set accent = 'rosa', person_color = 'cian' where id = pg_temp.id('a') $$);

select pg_temp.login_as(pg_temp.id('c'));

select lives_ok(
  $$ update public.profiles set person_color = 'azul' where id = pg_temp.id('c') $$,
  'C, de otro hogar, sí puede usar azul'
);

select is(
  (select count(*) from public.profiles where id in (pg_temp.id('a'), pg_temp.id('b'))),
  0::bigint,
  'C no ve los perfiles (ni los colores) de otro hogar'
);

reset role;

select results_eq(
  $$ select accent, person_color from public.profiles where id = pg_temp.id('a') $$,
  $$ values ('violeta'::text, 'azul'::text) $$,
  'B no pudo cambiar la apariencia de A'
);

-- ---------------------------------------------------------------------------
-- Color de categoría
-- ---------------------------------------------------------------------------
select pg_temp.login_as(pg_temp.id('b'));

select lives_ok(
  $$ update public.categories set color = 'coral', icon = 'utensils' where id = pg_temp.id('cat') $$,
  'B cambia el color y el icono de una categoría del hogar'
);

select throws_ok(
  $$ update public.categories set color = 'fucsia' where id = pg_temp.id('cat') $$,
  '23514', null, 'Color de categoría fuera de la paleta: rechazado'
);

select lives_ok(
  $$ update public.categories set color = null where id = pg_temp.id('cat') $$,
  'Volver al color neutro'
);

select pg_temp.login_as(pg_temp.id('c'));
select pg_temp.attempt($$ update public.categories set color = 'menta' where id = pg_temp.id('cat') $$);
reset role;

select is(
  (select color from public.categories where id = pg_temp.id('cat')),
  null,
  'C no puede cambiar el color de una categoría de otro hogar'
);

select is(
  (select count(*) from public.categories where color is not null and household_id = pg_temp.id('h')),
  0::bigint,
  'El hogar de A y B no tiene colores puestos por C'
);

select * from finish();
rollback;
