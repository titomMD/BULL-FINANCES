-- BULLMILTON · Personalización (Ajustes → Apariencia y Categorías)
--
-- Cada cuenta elige modo (oscuro/claro/automático), acento, su color de persona, densidad,
-- tamaño de texto, esquinas, movimiento reducido y modo privado. Los valores válidos son los de
-- src/lib/appearance.ts y los colores viven en src/styles/tokens.css (aquí solo hay ids).
-- Las categorías ganan un color de la misma paleta curada.

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column mode text not null default 'dark'
    check (mode in ('dark', 'light', 'system')),
  add column accent text not null default 'theme'
    check (accent in ('theme', 'amarillo', 'naranja', 'coral', 'violeta', 'azul', 'menta', 'rosa')),
  add column person_color text
    check (person_color is null
      or person_color in ('azul', 'naranja', 'violeta', 'rosa', 'cian', 'ambar')),
  add column density text not null default 'comoda'
    check (density in ('comoda', 'compacta')),
  add column text_size text not null default 'normal'
    check (text_size in ('normal', 'grande', 'muy_grande')),
  add column corners text not null default 'redondeadas'
    check (corners in ('redondeadas', 'suaves', 'rectas')),
  add column motion text not null default 'sistema'
    check (motion in ('sistema', 'reducido')),
  add column private_mode boolean not null default false;

-- Los temas que ya eran claros siguen viéndose claros.
update public.profiles set mode = 'light' where theme in ('papel', 'salvia');

comment on column public.profiles.person_color is
  'Color con el que se identifica a la persona (barras, reportes, avatar). Único entre los miembros activos de sus households.';

-- Dos miembros activos de un mismo household no pueden tener el mismo color: sería imposible
-- distinguirlos en los gráficos. SECURITY DEFINER para ver los perfiles de los otros miembros;
-- solo devuelve si hay choque, nunca datos.
create function private.person_color_taken(p_user_id uuid, p_color text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members other
      on other.household_id = mine.household_id
     and other.user_id <> mine.user_id
     and other.left_at is null
    join public.profiles p on p.id = other.user_id
    where mine.user_id = p_user_id
      and mine.left_at is null
      and p.person_color = p_color
  );
$$;

create function private.guard_person_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.person_color is not null
     and new.person_color is distinct from old.person_color
     and private.person_color_taken(new.id, new.person_color) then
    raise exception using message = 'person_color_taken', errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_person_color
  before update of person_color on public.profiles
  for each row execute function private.guard_person_color();

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
alter table public.categories
  add column color text
    check (color is null
      or color in ('ambar', 'naranja', 'coral', 'rosa', 'violeta', 'azul', 'cian', 'menta'));

comment on column public.categories.color is
  'Color de la paleta curada (src/styles/tokens.css); null = neutro.';

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant update (mode, accent, person_color, density, text_size, corners, motion, private_mode)
  on public.profiles to authenticated;
grant update (color) on public.categories to authenticated;

grant execute on function private.person_color_taken(uuid, text) to authenticated;
