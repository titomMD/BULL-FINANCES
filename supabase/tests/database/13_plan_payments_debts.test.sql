-- Freyapp · pgTAP · Pagos del plan, tanqueadas, tarjetas, extractos e ingreso del plan
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select set_config('test.hb', public.create_household('Mis finanzas')::text, true);

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');

insert into public.plan_items (household_id, kind, name, amount, tracked)
values (current_setting('test.ha')::uuid, 'expense', 'Gasolina', 650000, true);
select set_config('test.gas', (select id::text from public.plan_items where name = 'Gasolina'), true);

-- Pagos marcados
select lives_ok(
  format($$ insert into public.plan_checks (household_id, plan_item_id, month) values (%L, %L, '2026-10') $$,
         current_setting('test.ha'), current_setting('test.gas')),
  'A marca una línea como pagada'
);
select throws_ok(
  format($$ insert into public.plan_checks (household_id, plan_item_id, month) values (%L, %L, '2026-10') $$,
         current_setting('test.ha'), current_setting('test.gas')),
  '23505', null, 'No se marca dos veces el mismo mes'
);
select throws_ok(
  format($$ insert into public.plan_checks (household_id, plan_item_id, month) values (%L, %L, '2026-13') $$,
         current_setting('test.ha'), current_setting('test.gas')),
  '23514', null, 'El mes debe ser válido'
);

-- Tanqueadas
select lives_ok(
  format($$ insert into public.plan_entries (household_id, plan_item_id, entry_date, amount, note)
            values (%L, %L, '2026-10-05', 120000, 'Terpel') $$,
         current_setting('test.ha'), current_setting('test.gas')),
  'A registra una tanqueada'
);
select throws_ok(
  format($$ insert into public.plan_entries (household_id, plan_item_id, amount) values (%L, %L, 0) $$,
         current_setting('test.ha'), current_setting('test.gas')),
  '23514', null, 'No se aceptan tanqueadas de 0'
);

-- Tarjetas y extractos
select lives_ok(
  format($$ insert into public.debt_accounts (household_id, name, last4) values (%L, 'Visa', '1234') $$,
         current_setting('test.ha')),
  'A crea una tarjeta con los últimos 4 dígitos'
);
select throws_ok(
  format($$ insert into public.debt_accounts (household_id, name, last4) values (%L, 'Larga', '1234567890123456') $$,
         current_setting('test.ha')),
  '23514', null, 'No se guarda el número completo de la tarjeta'
);
select set_config('test.visa', (select id::text from public.debt_accounts where name = 'Visa'), true);

select lives_ok(
  format($$ insert into public.debt_statements (household_id, account_id, statement_date, due_date, pay_month,
                                                total_due, minimum_due, lines)
            values (%L, %L, '2026-10-15', '2026-10-30', '2026-10', 480000, 60000,
                    '[{"date":"2026-10-02","detail":"Rappi","amount":35000}]') $$,
         current_setting('test.ha'), current_setting('test.visa')),
  'A guarda un extracto con sus movimientos'
);
select throws_ok(
  format($$ insert into public.debt_statements (household_id, account_id, statement_date, pay_month, total_due, lines)
            values (%L, %L, '2026-11-15', '2026-11', 1000, '{"no":"lista"}') $$,
         current_setting('test.ha'), current_setting('test.visa')),
  '23514', null, 'Los movimientos del extracto deben ser una lista'
);
select throws_ok(
  format($$ insert into public.debt_statements (household_id, account_id, statement_date, pay_month, total_due, file_path)
            values (%L, %L, '2026-11-15', '2026-11', 1000, '22222222-2222-2222-2222-222222222222/x.pdf') $$,
         current_setting('test.ha'), current_setting('test.visa')),
  '23514', null, 'El archivo del extracto debe estar en la carpeta de quien lo guarda'
);

-- Ingreso del plan (Dinero mío): uno activo por mes
select lives_ok(
  format($$ insert into public.personal_movements (household_id, kind, description, amount, date, plan_month)
            values (%L, 'income', 'Dinero mío (plan)', 1000000, '2026-10-01', '2026-10') $$,
         current_setting('test.ha')),
  'A recibe su Dinero mío del mes como ingreso'
);
select throws_ok(
  format($$ insert into public.personal_movements (household_id, kind, description, amount, date, plan_month)
            values (%L, 'income', 'Dinero mío (plan)', 900000, '2026-10-01', '2026-10') $$,
         current_setting('test.ha')),
  '23505', null, 'No se duplica el ingreso del plan del mismo mes'
);

-- B no ve ni toca nada de A
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.plan_checks)
  + (select count(*)::int from public.plan_entries)
  + (select count(*)::int from public.debt_accounts)
  + (select count(*)::int from public.debt_statements),
  0, 'B no ve pagos, tanqueadas, tarjetas ni extractos de A'
);
select throws_ok(
  format($$ insert into public.plan_checks (household_id, plan_item_id, month) values (%L, %L, '2026-11') $$,
         current_setting('test.hb'), current_setting('test.gas')),
  null, null, 'B no puede marcar pagos en líneas de A'
);
select throws_ok(
  format($$ insert into public.debt_statements (household_id, account_id, statement_date, pay_month, total_due)
            values (%L, %L, '2026-11-15', '2026-11', 1000) $$,
         current_setting('test.hb'), current_setting('test.visa')),
  null, null, 'B no puede colgar extractos de la tarjeta de A'
);

delete from public.debt_accounts;
reset role;
select is((select count(*)::int from public.debt_accounts), 1, 'B no puede borrar la tarjeta de A');

-- Borrar la tarjeta borra sus extractos
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
delete from public.debt_accounts where name = 'Visa';
reset role;
select is((select count(*)::int from public.debt_statements), 0, 'Al borrar la tarjeta se borran sus extractos');

select * from finish();
rollback;
