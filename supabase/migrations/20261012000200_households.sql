-- =============================================================================
-- BULLMILTON · 02 · Households, miembros e invitaciones
--
-- Regla de acceso (spec §28): auth.uid() → household_members (activo) → household_id.
-- Crear un household, invitar, aceptar y abandonar son RPC SECURITY DEFINER porque RLS
-- no puede resolver esos casos (quien acepta aún no es miembro; quien crea aún no tiene
-- membresía). Cada RPC valida explícitamente la identidad y la pertenencia.
-- =============================================================================

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

comment on table public.households is 'Espacio financiero compartido.';

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  -- Abandonar no borra la fila: el historial sigue apuntando a esta persona.
  left_at timestamptz,
  unique (household_id, user_id),
  check (left_at is null or left_at >= joined_at)
);

comment on table public.household_members is
  'Pertenencia a households. left_at no nulo = ya no es miembro activo (se conserva por el historial).';

-- MVP: un usuario pertenece a un único household activo (spec §5).
create unique index household_members_one_active_per_user
  on public.household_members (user_id)
  where left_at is null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  -- 10 caracteres de un alfabeto de 32 sin ambigüedades (sin I, O, 0, 1): 2^50 combinaciones.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check ((used_at is null) = (used_by is null)),
  check (expires_at > created_at)
);

comment on table public.invitations is 'Códigos de invitación de un solo uso para unirse a un household.';

create index invitations_household_id_idx on public.invitations (household_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;

create trigger households_audit
  before insert or update on public.households
  for each row execute function private.set_audit_fields();

-- ---------------------------------------------------------------------------
-- Helpers de pertenencia. SECURITY DEFINER para leer household_members sin recursión de RLS.
-- ---------------------------------------------------------------------------

-- Households activos del usuario actual. Se usa en las políticas como
-- `household_id in (select private.current_household_ids())`, que Postgres evalúa una
-- sola vez por consulta (initPlan) en lugar de una vez por fila.
create function private.current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.left_at is null;
$$;

create function private.is_active_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = p_user_id
      and m.left_at is null
  );
$$;

-- ¿p_user_id es (o fue) miembro de alguno de mis households activos? Permite ver el nombre
-- de quien ya se fue en el historial.
create function private.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members other on other.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and mine.left_at is null
      and other.user_id = p_user_id
  );
$$;

create function private.generate_invitation_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- gen_random_uuid() usa el generador criptográfico de Postgres. Se toman solo bytes que no
  -- contienen los bits fijos de versión/variante (posiciones 6 y 8).
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_positions constant int[] := array[0, 1, 2, 3, 4, 5, 10, 11, 12, 13];
  v_code text := '';
  v_pos int;
begin
  foreach v_pos in array v_positions loop
    -- 256 es múltiplo de 32: el módulo no introduce sesgo.
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_pos) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

create policy "profiles: ver el propio y los de mi household"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or private.shares_household_with(id));

create policy "profiles: editar el propio"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "households: ver los míos"
  on public.households for select
  to authenticated
  using (id in (select private.current_household_ids()));

create policy "households: editar los míos"
  on public.households for update
  to authenticated
  using (id in (select private.current_household_ids()))
  with check (id in (select private.current_household_ids()));

create policy "household_members: ver los de mi household"
  on public.household_members for select
  to authenticated
  using (household_id in (select private.current_household_ids()));

create policy "invitations: ver las de mi household"
  on public.invitations for select
  to authenticated
  using (household_id in (select private.current_household_ids()));

create policy "invitations: revocar las no usadas de mi household"
  on public.invitations for delete
  to authenticated
  using (household_id in (select private.current_household_ids()) and used_at is null);

-- Sin políticas de INSERT/DELETE en households ni de escritura en household_members:
-- esas operaciones solo existen a través de las RPC de abajo.

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- private.seed_default_categories() se define en la migración 03 junto a categories.

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  if exists (
    select 1 from public.household_members where user_id = v_uid and left_at is null
  ) then
    raise exception using message = 'already_in_household', errcode = 'P0001';
  end if;

  insert into public.households (name)
  values (btrim(p_name))
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_uid, 'owner');

  perform private.seed_default_categories(v_household_id);

  return v_household_id;
end;
$$;

comment on function public.create_household(text) is
  'Crea un household con el usuario actual como owner y sus categorías iniciales.';

create function public.create_invitation(p_household_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  if not private.is_active_member(p_household_id, v_uid) then
    raise exception using message = 'forbidden', errcode = '42501';
  end if;

  loop
    v_code := private.generate_invitation_code();
    begin
      insert into public.invitations (household_id, created_by, code, expires_at)
      values (p_household_id, v_uid, v_code, v_expires_at);
      exit;
    exception when unique_violation then
      -- Colisión de código (improbable): se genera otro.
    end;
  end loop;

  return query select v_code, v_expires_at;
end;
$$;

comment on function public.create_invitation(uuid) is
  'Genera un código de invitación de un solo uso, válido 7 días.';

create function public.accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.invitations%rowtype;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  -- FOR UPDATE: dos aceptaciones simultáneas del mismo código no pueden ganar ambas.
  select * into v_invitation
  from public.invitations
  where code = upper(btrim(p_code))
  for update;

  -- Un único mensaje para "no existe", "usado" y "vencido": no revela qué códigos existen.
  if not found or v_invitation.used_at is not null or v_invitation.expires_at <= now() then
    raise exception using message = 'invalid_invitation', errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.household_members where user_id = v_uid and left_at is null
  ) then
    raise exception using message = 'already_in_household', errcode = 'P0001';
  end if;

  -- Si la persona ya estuvo en este household, se reactiva su membresía.
  insert into public.household_members (household_id, user_id, role)
  values (v_invitation.household_id, v_uid, 'member')
  on conflict (household_id, user_id)
  do update set left_at = null, joined_at = now(), role = 'member';

  update public.invitations
  set used_at = now(), used_by = v_uid
  where id = v_invitation.id;

  return v_invitation.household_id;
end;
$$;

comment on function public.accept_invitation(text) is
  'Une al usuario actual al household del código. Falla si el código no es válido o ya pertenece a otro.';

create function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = '42501';
  end if;

  update public.household_members
  set left_at = now()
  where household_id = p_household_id
    and user_id = v_uid
    and left_at is null
  returning role into v_role;

  if not found then
    raise exception using message = 'forbidden', errcode = '42501';
  end if;

  -- Si se va el owner, el miembro activo más antiguo pasa a ser owner.
  if v_role = 'owner' then
    update public.household_members
    set role = 'owner'
    where id = (
      select id
      from public.household_members
      where household_id = p_household_id and left_at is null
      order by joined_at, id
      limit 1
    );
  end if;
end;
$$;

comment on function public.leave_household(uuid) is
  'Marca al usuario actual como fuera del household. El historial se conserva.';

-- ---------------------------------------------------------------------------
-- Privilegios: solo lo imprescindible, solo para authenticated.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name) on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, delete on public.invitations to authenticated;

grant execute on function private.current_household_ids() to authenticated;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.shares_household_with(uuid) to authenticated;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
