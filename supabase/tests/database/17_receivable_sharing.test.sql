-- Freyapp · pgTAP · Compartir «Mamá me debe» en solo lectura
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

create function pg_temp.login_as(p_id uuid, p_email text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'email', p_email)::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'juan@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Juan Esteban"}'),
  ('22222222-2222-2222-2222-222222222222', 'mama@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Mamá"}'),
  ('33333333-3333-3333-3333-333333333333', 'otro@freyapp.test', 'authenticated', 'authenticated', '{"display_name":"Otro"}');

update public.profiles set pockets_enabled = true where id = '11111111-1111-1111-1111-111111111111';

select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'juan@freyapp.test');
select set_config('test.ha', public.create_household('Mis finanzas')::text, true);

select lives_ok(
  format($$ insert into public.receivable_entries (household_id, kind, amount, entry_date, note)
            values (%L, 'charge', 120000, '2026-10-19', 'Almuerzos'), (%L, 'payment', 2000000, '2026-10-20', 'Pago') $$,
         current_setting('test.ha'), current_setting('test.ha')),
  'Juan registra un cobro y un pago'
);
select throws_ok(
  format($$ insert into public.receivable_shares (viewer_email, label) values ('Mama@Freyapp.test ', 'Juan') $$),
  '23514', null, 'El correo debe venir limpio y en minúsculas'
);
select lives_ok(
  $$ insert into public.receivable_shares (viewer_email, label) values ('mama@freyapp.test', 'Juan') $$,
  'Juan comparte con el correo de su mamá'
);

-- Mamá
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'mama@freyapp.test');
select is((select count(*)::int from public.receivable_entries), 2, 'Mamá ve los dos movimientos');
select is(
  (select owner_name from public.ledgers_shared_with_me()), 'Juan Esteban',
  'Mamá ve de quién es la libreta'
);
select is((select label from public.ledgers_shared_with_me()), 'Juan', 'Y el nombre de su botón');
select throws_ok(
  $$ insert into public.receivable_entries (household_id, user_id, kind, amount)
     values ((select household_id from public.receivable_entries limit 1), '11111111-1111-1111-1111-111111111111', 'payment', 1) $$,
  '42501', null, 'Mamá no puede escribir en la libreta de Juan'
);
select lives_ok($$ delete from public.receivable_entries $$, 'Mamá intenta borrar (no toca nada)');
select is((select count(*)::int from public.pockets), 0, 'Mamá no ve sus bolsillos');

-- Otra persona
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'otro@freyapp.test');
select is((select count(*)::int from public.receivable_entries), 0, 'Otra persona no ve la libreta');
select is((select count(*)::int from public.ledgers_shared_with_me()), 0, 'Ni aparece como compartida');
select is((select count(*)::int from public.receivable_shares), 0, 'Ni ve a quién se compartió');

-- Juan deja de compartir
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'juan@freyapp.test');
select is((select count(*)::int from public.receivable_entries), 2, 'Los movimientos de Juan siguen intactos');
delete from public.receivable_shares;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'mama@freyapp.test');
select is((select count(*)::int from public.receivable_entries), 0, 'Sin compartir, mamá ya no ve nada');

-- Una cuenta sin el interruptor no puede compartir
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'otro@freyapp.test');
select throws_ok(
  $$ insert into public.receivable_shares (viewer_email, label) values ('x@freyapp.test', 'X') $$,
  '42501', null, 'Sin el interruptor no se puede compartir'
);

select * from finish();
rollback;
