-- BULLMILTON · Registro solo con invitación (decisión del usuario, 2026-10-12)
--
-- La app permite crear cuenta en /registro, pero solo con un código de invitación vigente de un
-- hogar. Lo hace cumplir Supabase Auth con el hook "Before User Created", que llama a esta
-- función antes de crear el usuario: sin código válido, la cuenta no se crea.
--
-- Hay que activarlo en el panel (docs/SUPABASE.md): Authentication → Hooks → Before User Created
-- → Postgres → public.hook_before_user_created. En local lo activa supabase/config.toml.
--
-- El código no se consume aquí: lo consume accept_invitation() al unirse al hogar (con
-- bloqueo de fila), así que dos registros con el mismo código no pueden quedarse ambos dentro.

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(event -> 'user' -> 'user_metadata' ->> 'invite_code', '')));
begin
  if v_code ~ '^[A-HJ-NP-Z2-9]{10}$' and exists (
    select 1
    from public.invitations i
    where i.code = v_code
      and i.used_at is null
      and i.expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;

  -- Un único mensaje para "no hay código", "no existe", "usado" y "vencido".
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'invalid_invitation')
  );
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Hook de Supabase Auth (Before User Created): solo deja crear cuentas con un código de invitación vigente.';

-- ---------------------------------------------------------------------------
-- Privilegios: solo Supabase Auth puede llamarla; ni la app ni usuarios anónimos.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
