-- =============================================================================
-- BULLMILTON · Seed de DESARROLLO LOCAL (se ejecuta con `supabase db reset`).
-- NO usar en producción: crea cuentas con contraseñas conocidas.
--
--   ana@bullmilton.test   / Bullmilton2026
--   beto@bullmilton.test  / Bullmilton2026
--
-- Household "Casa" con ambos, y movimientos del mes actual.
-- =============================================================================

-- Cuentas (formato que espera Supabase Auth para login con email + contraseña).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'ana@bullmilton.test',
    extensions.crypt('Bullmilton2026', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"display_name": "Ana"}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'beto@bullmilton.test',
    extensions.crypt('Bullmilton2026', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"display_name": "Beto"}', now(), now(),
    '', '', '', ''
  );

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email in ('ana@bullmilton.test', 'beto@bullmilton.test');

-- Datos de la app, creados a través de las mismas RPC que usa el frontend.
do $$
declare
  v_ana constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_beto constant uuid := 'b0000000-0000-4000-8000-000000000002';
  v_household uuid;
  v_code text;
  v_month_start date := date_trunc('month', private.today_bogota())::date;
  v_cat jsonb;
begin
  -- Ana crea el household e invita a Beto.
  perform set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
  v_household := public.create_household('Casa');
  select code into v_code from public.create_invitation(v_household);

  perform set_config('request.jwt.claims', json_build_object('sub', v_beto, 'role', 'authenticated')::text, true);
  perform public.accept_invitation(v_code);

  select jsonb_object_agg(c.name, c.id) into v_cat
  from public.categories c
  where c.household_id = v_household;

  -- Gastos (Ana)
  perform set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
  perform public.create_expense(v_household, 'Arriendo', 1000000, (v_cat ->> 'Vivienda')::uuid, v_ana,
    p_date => v_month_start);
  perform public.create_expense(v_household, 'Mercado', 240000, (v_cat ->> 'Comida')::uuid, v_ana,
    p_date => v_month_start + 3);
  perform public.create_expense(v_household, 'Internet', 95000, (v_cat ->> 'Servicios')::uuid, v_ana,
    'percentage',
    jsonb_build_array(
      jsonb_build_object('user_id', v_ana, 'share_bp', 7000),
      jsonb_build_object('user_id', v_beto, 'share_bp', 3000)),
    v_month_start + 5);

  perform public.create_income(v_household, v_ana, 'Salario', 3200000, (v_cat ->> 'Trabajo')::uuid,
    p_date => v_month_start);
  -- Ingreso compartido: lo recibió Ana, es de los dos (solo reportes; no crea deuda).
  perform public.create_income(v_household, v_ana, 'Mesada papás', 800000, (v_cat ->> 'Mesada')::uuid,
    'equal', jsonb_build_array(v_ana, v_beto), v_month_start + 1);

  -- Gastos (Beto)
  perform set_config('request.jwt.claims', json_build_object('sub', v_beto, 'role', 'authenticated')::text, true);
  perform public.create_expense(v_household, 'Gasolina', 120000, (v_cat ->> 'Transporte')::uuid, v_beto,
    p_date => v_month_start + 2);
  perform public.create_expense(v_household, 'Netflix', 44900, (v_cat ->> 'Suscripciones')::uuid, v_beto,
    p_date => v_month_start + 4);

  perform public.create_income(v_household, v_beto, 'Freelance', 1500000, (v_cat ->> 'Freelance')::uuid,
    p_date => v_month_start + 1);

  insert into public.transfers (household_id, from_user, to_user, amount, date, notes)
  values (v_household, v_beto, v_ana, 300000, v_month_start + 6, 'Abono arriendo');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
