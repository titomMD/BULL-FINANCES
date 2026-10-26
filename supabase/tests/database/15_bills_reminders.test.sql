-- Freyapp · pgTAP · Día de pago, aviso y recibo adjunto en el plan
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

create function pg_temp.login_as(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Ana"}');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.ha', public.create_household('Mis finanzas')::text, true);

select lives_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount, tracked, due_day, remind_days)
            values (%L, 'expense', 'Luz', 180000, true, 12, 2) $$, current_setting('test.ha')),
  'A crea un recibo con tope, día de pago y aviso'
);
select set_config('test.luz', (select id::text from public.plan_items where name = 'Luz'), true);
select is((select remind_days from public.plan_items where name = 'Luz'), 2, 'Guarda los días de aviso');

select lives_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount) values (%L, 'expense', 'Agua', 90000) $$,
         current_setting('test.ha')),
  'Sin día de pago, el aviso queda en 3 días por defecto'
);
select is((select remind_days from public.plan_items where name = 'Agua'), 3, 'El aviso por defecto es 3 días');
select throws_ok(
  format($$ insert into public.plan_items (household_id, kind, name, amount, due_day) values (%L, 'expense', 'Gas', 1000, 32) $$,
         current_setting('test.ha')),
  '23514', null, 'El día de pago debe estar entre 1 y 31'
);

select lives_ok(
  format($$ insert into public.plan_entries (household_id, plan_item_id, amount, file_path, file_name)
            values (%L, %L, 175000, '11111111-1111-1111-1111-111111111111/recibo.pdf', 'recibo.pdf') $$,
         current_setting('test.ha'), current_setting('test.luz')),
  'A adjunta el PDF del recibo a su registro'
);
select throws_ok(
  format($$ insert into public.plan_entries (household_id, plan_item_id, amount, file_path)
            values (%L, %L, 1000, '22222222-2222-2222-2222-222222222222/x.pdf') $$,
         current_setting('test.ha'), current_setting('test.luz')),
  '23514', null, 'El recibo debe estar en la carpeta de quien lo guarda'
);

select * from finish();
rollback;
