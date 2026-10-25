-- =============================================================================
-- BULLMILTON · 01 · Base
-- Esquema privado para helpers, endurecimiento de privilegios, triggers comunes y perfiles.
--
-- Convenciones de todo el esquema:
--   * Dinero: bigint en la unidad mínima de la moneda (COP sin decimales). Nunca float.
--   * Porcentajes: enteros en puntos básicos (share_bp): 10000 = 100,00 %.
--   * Fechas financieras: tipo date, "hoy" calculado en America/Bogota.
--   * Errores de negocio: SQLSTATE P0001 / 23514 / 42501 con una clave estable en el mensaje
--     (p. ej. 'already_in_household'); el frontend la traduce a un texto humano.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Privilegios por defecto: nada nuevo queda accesible para anon/authenticated sin un GRANT
-- explícito, sea cual sea el valor de "auto expose" del proyecto en la nube.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- Además, Postgres concede EXECUTE a PUBLIC en toda función nueva (default global que no se
-- puede quitar por esquema). Por eso CADA migración termina con
--   revoke execute on all functions in schema public, private from public, anon;
-- seguido de GRANTs explícitos a authenticated. El test 01_security lo verifica.

-- ---------------------------------------------------------------------------
-- Esquema privado: no está en api.schemas, así que la Data API no lo expone.
-- authenticated necesita USAGE porque las políticas RLS llaman a estos helpers.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- "Hoy" financiero en Colombia, independiente de la zona horaria del servidor o del navegador.
create function private.today_bogota()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- updated_at para tablas sin columnas de auditoría completas.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auditoría (spec §22): quién y cuándo creó / modificó. El cliente no puede falsificarlo:
-- con sesión, created_by/updated_by salen siempre de auth.uid(). Sin sesión (seeds/migraciones
-- ejecutadas como postgres) se respeta el valor dado.
create function private.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_at := new.created_at;
    new.updated_by := new.created_by;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

-- Un registro nunca cambia de household (spec §29: no reasignar registros a otro household).
create function private.prevent_household_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception using message = 'household_immutable', errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: datos de aplicación de cada cuenta de Supabase Auth.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos de aplicación de cada usuario de Supabase Auth.';

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Crea el perfil al registrarse. display_name viene de options.data.display_name en signUp().
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      ),
      60
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Las políticas de profiles dependen de household_members: se definen en la migración 02.

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant execute on function private.today_bogota() to authenticated;
