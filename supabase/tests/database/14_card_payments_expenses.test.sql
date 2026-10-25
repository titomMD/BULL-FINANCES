-- Freyapp · pgTAP · Pagos a tarjetas (pesos y dólares), gastos con tarjeta y cuota de manejo
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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
insert into public.plan_items (household_id, kind, name, amount) values
  (current_setting('test.ha')::uuid, 'expense', 'Cuota de manejo', 18000);
insert into public.debt_accounts (household_id, name, last4, fee_plan_item_id)
  values (current_setting('test.ha')::uuid, 'Joven', '6932', (select id from public.plan_items where name = 'Cuota de manejo'));
select set_config('test.card', (select id::text from public.debt_accounts where name = 'Joven'), true);
insert into public.debt_statements (household_id, account_id, statement_date, due_date, pay_month,
                                    total_due, minimum_due, usd_total_due, usd_minimum_due, fee_amount, monthly_rate_ppm)
values (current_setting('test.ha')::uuid, current_setting('test.card')::uuid, '2026-09-15', '2026-10-05', '2026-10',
        2976719, 243388, 6500, 300, 17250, 21593);
select set_config('test.fee', (select id::text from public.plan_items where name = 'Cuota de manejo'), true);
select set_config('test.st', (select id::text from public.debt_statements limit 1), true);

-- Marca con valor distinto al del plan
select lives_ok(
  format($$ insert into public.plan_checks (household_id, plan_item_id, month, paid_amount)
            values (%L, (select id from public.plan_items where name = 'Cuota de manejo'), '2026-10', 17250) $$,
         current_setting('test.ha')),
  'A marca la cuota de manejo con lo realmente cobrado'
);

-- Pagos en pesos y en dólares, cada uno por su lado
select lives_ok(
  format($$ insert into public.debt_payments (household_id, account_id, statement_id, currency, amount, kind)
            values (%L, %L, %L, 'COP', 243388, 'minimum') $$,
         current_setting('test.ha'), current_setting('test.card'), current_setting('test.st')),
  'A paga el mínimo en pesos'
);
select lives_ok(
  format($$ insert into public.debt_payments (household_id, account_id, statement_id, currency, amount, kind, fx_rate_cents)
            values (%L, %L, %L, 'USD', 300, 'minimum', 390000) $$,
         current_setting('test.ha'), current_setting('test.card'), current_setting('test.st')),
  'A paga el mínimo en dólares'
);
select is(
  (select paid_amount::text || '/' || usd_paid::text from public.debt_statements where id = current_setting('test.st')::uuid),
  '243388/300', 'El extracto suma los pagos de cada moneda por separado'
);
select lives_ok(
  format($$ insert into public.debt_payments (household_id, account_id, statement_id, currency, amount, kind)
            values (%L, %L, %L, 'COP', 100000, 'extra') $$,
         current_setting('test.ha'), current_setting('test.card'), current_setting('test.st')),
  'A hace un abono extra'
);
select is(
  (select paid_amount from public.debt_statements where id = current_setting('test.st')::uuid),
  343388::bigint, 'El abono se suma a lo pagado en pesos'
);
delete from public.debt_payments where kind = 'extra';
select is(
  (select paid_amount from public.debt_statements where id = current_setting('test.st')::uuid),
  243388::bigint, 'Al borrar el abono, el extracto lo descuenta'
);
select throws_ok(
  format($$ insert into public.debt_payments (household_id, account_id, currency, amount) values (%L, %L, 'EUR', 5) $$,
         current_setting('test.ha'), current_setting('test.card')),
  '23514', null, 'Solo se aceptan pesos o dólares'
);

-- Gastos con la tarjeta
select lives_ok(
  format($$ insert into public.debt_card_expenses (household_id, account_id, description, currency, amount, fx_rate_cents)
            values (%L, %L, 'Netflix', 'USD', 1599, 390000) $$,
         current_setting('test.ha'), current_setting('test.card')),
  'A registra un gasto en dólares con la tarjeta'
);

-- La cuota de manejo solo puede apuntar a una línea propia
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
insert into public.plan_items (household_id, kind, name, amount) values (current_setting('test.hb')::uuid, 'expense', 'Otra', 1000);
select throws_ok(
  format($$ insert into public.debt_accounts (household_id, name, fee_plan_item_id)
            values (%L, 'Rara', %L) $$,
         current_setting('test.hb'), current_setting('test.fee')),
  null, null, 'B no puede enlazar la cuota de manejo a una línea de A'
);

-- B no ve pagos ni gastos de A
select is(
  (select count(*)::int from public.debt_payments) + (select count(*)::int from public.debt_card_expenses),
  0, 'B no ve pagos ni gastos con tarjeta de A'
);
select throws_ok(
  format($$ insert into public.debt_payments (household_id, account_id, currency, amount) values (%L, %L, 'COP', 5) $$,
         current_setting('test.hb'), current_setting('test.card')),
  null, null, 'B no puede registrar pagos en la tarjeta de A'
);

select * from finish();
rollback;
