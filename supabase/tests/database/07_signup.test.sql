-- BULLMILTON · pgTAP · Registro solo con invitación (hook Before User Created)
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create function pg_temp.login_as(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.event(p_code text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'metadata', jsonb_build_object('name', 'before-user-created'),
    'user', jsonb_build_object('email', 'nuevo@bullmilton.test',
      'user_metadata', case when p_code is null then '{}'::jsonb
                            else jsonb_build_object('invite_code', p_code) end));
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'a@bullmilton.test', 'authenticated', 'authenticated', '{"display_name":"Ana"}');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.h', public.create_household('Casa')::text, true);
select set_config('test.code', (select code from public.create_invitation(current_setting('test.h')::uuid)), true);
reset role;

select is(
  public.hook_before_user_created(pg_temp.event(current_setting('test.code'))),
  '{}'::jsonb,
  'Con un código vigente, Auth puede crear la cuenta'
);

select is(
  public.hook_before_user_created(pg_temp.event(lower(' ' || current_setting('test.code') || ' '))),
  '{}'::jsonb,
  'El código se acepta sin importar mayúsculas ni espacios'
);

select is(
  public.hook_before_user_created(pg_temp.event(null)) -> 'error' ->> 'message',
  'invalid_invitation',
  'Sin código no se crea la cuenta'
);

select is(
  public.hook_before_user_created(pg_temp.event('ABCDEFGHJK')) -> 'error' ->> 'message',
  'invalid_invitation',
  'Un código que no existe no sirve'
);

select is(
  (public.hook_before_user_created(pg_temp.event('x'' or 1=1 --')) -> 'error' ->> 'http_code')::int,
  403,
  'Basura en el código se rechaza con 403'
);

update public.invitations set used_at = now(), used_by = '11111111-1111-1111-1111-111111111111'
where code = current_setting('test.code');

select is(
  public.hook_before_user_created(pg_temp.event(current_setting('test.code'))) -> 'error' ->> 'message',
  'invalid_invitation',
  'Un código ya usado no sirve'
);

update public.invitations set used_at = null, used_by = null,
  created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where code = current_setting('test.code');

select is(
  public.hook_before_user_created(pg_temp.event(current_setting('test.code'))) -> 'error' ->> 'message',
  'invalid_invitation',
  'Un código vencido no sirve'
);

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.hook_before_user_created('{}'::jsonb) $$,
  '42501',
  null,
  'Un usuario de la app no puede llamar al hook'
);
reset role;

set local role anon;
select throws_ok(
  $$ select public.hook_before_user_created('{}'::jsonb) $$,
  '42501',
  null,
  'Un visitante anónimo no puede llamar al hook'
);
reset role;

select * from finish();
rollback;
