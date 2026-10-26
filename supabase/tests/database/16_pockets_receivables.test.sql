-- Freyapp · pgTAP · Bolsillos, traslados/préstamos y cuenta con mamá
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

create function pg_temp.login_as(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.ha', public.create_household('Mis finanzas')::text, true);

select lives_ok(
  format($$ insert into public.pockets (household_id, name, goal, covers_receivable)
            values (%L, '1ER SEMESTRE 2027', 13704000, true), (%L, 'GASOLINA', 800000, false) $$,
         current_setting('test.ha'), current_setting('test.ha')),
  'A crea dos bolsillos'
);
select set_config('test.sem', (select id::text from public.pockets where name = '1ER SEMESTRE 2027'), true);
select set_config('test.gas', (select id::text from public.pockets where name = 'GASOLINA'), true);

select lives_ok(
  format($$ insert into public.pocket_moves (household_id, pocket_id, amount, kind)
            values (%L, %L, 13704000, 'deposit') $$, current_setting('test.ha'), current_setting('test.sem')),
  'A deposita en el bolsillo'
);
select throws_ok(
  format($$ insert into public.pocket_moves (household_id, pocket_id, amount, kind)
            values (%L, %L, 500, 'withdraw') $$, current_setting('test.ha'), current_setting('test.sem')),
  '23514', null, 'Un retiro debe ser negativo'
);

select lives_ok(
  format($$ select public.move_between_pockets(%L, %L, 5998500, 'loan', null, 'Cubrir tarjetas') $$,
         current_setting('test.sem'), current_setting('test.gas')),
  'A presta del semestre a gasolina (atómico)'
);
select is(
  (select sum(amount)::bigint from public.pocket_moves where pocket_id = current_setting('test.sem')::uuid),
  7705500::bigint,
  'El bolsillo que presta baja'
);
select is(
  (select sum(amount)::bigint from public.pocket_moves where pocket_id = current_setting('test.gas')::uuid),
  5998500::bigint,
  'El bolsillo que recibe sube'
);
select throws_ok(
  format($$ select public.move_between_pockets(%L, %L, 1, 'transfer') $$,
         current_setting('test.sem'), current_setting('test.sem')),
  '22023', null, 'No se puede trasladar a sí mismo'
);

select lives_ok(
  format($$ delete from public.pocket_moves where kind = 'loan_in' and pocket_id = %L $$, current_setting('test.gas')),
  'A borra una mitad del préstamo'
);
select is(
  (select count(*)::int from public.pocket_moves where kind = 'loan_out'),
  0,
  'Se borra también la otra mitad'
);

-- Cuenta con mamá
select lives_ok(
  format($$ insert into public.receivable_rules (household_id, label, amount, frequency, starts_on)
            values (%L, 'Almuerzos', 120000, 'weekly', '2026-10-05') $$, current_setting('test.ha')),
  'A crea un cobro semanal'
);
select set_config('test.rule', (select id::text from public.receivable_rules limit 1), true);
select lives_ok(
  format($$ insert into public.receivable_entries (household_id, kind, amount, entry_date, rule_id)
            values (%L, 'charge', 120000, '2026-10-05', %L) $$, current_setting('test.ha'), current_setting('test.rule')),
  'Se registra el cobro automático'
);
select throws_ok(
  format($$ insert into public.receivable_entries (household_id, kind, amount, entry_date, rule_id)
            values (%L, 'charge', 120000, '2026-10-05', %L) $$, current_setting('test.ha'), current_setting('test.rule')),
  '23505', null, 'No se duplica el cobro de la misma regla y día'
);

-- B no ve nada de A ni puede tocarlo
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select set_config('test.hb', public.create_household('Hogar B')::text, true);
select is((select count(*)::int from public.pockets), 0, 'B no ve los bolsillos de A');
select is((select count(*)::int from public.receivable_entries), 0, 'B no ve la cuenta de A');
select throws_ok(
  format($$ select public.move_between_pockets(%L, %L, 10, 'transfer') $$,
         current_setting('test.sem'), current_setting('test.gas')),
  '22023', null, 'B no puede mover dinero de bolsillos ajenos'
);

select * from finish();
rollback;
