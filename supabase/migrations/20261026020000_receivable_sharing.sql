-- Freyapp · Compartir «Mamá me debe» en solo lectura (pedido del usuario, 2026-10-25)
--
-- receivable_shares: el dueño de la libreta indica el correo de quien puede VERLA (su mamá). Esa
-- persona crea su propia cuenta con ese correo y ve, en su menú, un botón con el nombre que el dueño
-- eligió. Solo puede leer los cobros y pagos (receivable_entries); nunca escribirlos, ni ver nada más
-- (bolsillos, plan, tarjetas…).
--
-- El correo se compara con el del token de sesión (auth.jwt() ->> 'email'). Conviene tener activada
-- la confirmación de correo en Supabase para que nadie pueda registrarse con un correo ajeno.

create table public.receivable_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  viewer_email text not null
    check (viewer_email = lower(btrim(viewer_email)) and viewer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
           and char_length(viewer_email) <= 254),
  -- Cómo se llama el botón en el menú de quien la ve (p. ej. «Juan»).
  label text not null default 'Libreta' check (char_length(btrim(label)) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, viewer_email)
);

comment on table public.receivable_shares is
  'Personas que pueden ver (solo lectura) la libreta «Mamá me debe» de su dueño.';

create index receivable_shares_viewer_idx on public.receivable_shares (viewer_email);

alter table public.receivable_shares enable row level security;

-- El dueño ve y gestiona los suyos; quien recibe ve solo los dirigidos a su correo.
create policy "receivable_shares: ver los míos o los dirigidos a mí" on public.receivable_shares
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or viewer_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
create policy "receivable_shares: crear los míos" on public.receivable_shares
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "receivable_shares: editar los míos" on public.receivable_shares
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "receivable_shares: borrar los míos" on public.receivable_shares
  for delete to authenticated using (user_id = (select auth.uid()));

-- Solo cuentas con los bolsillos activados pueden compartir (misma puerta que el resto).
create policy "receivable_shares: solo cuentas autorizadas" on public.receivable_shares
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.pockets_enabled
  ));

-- Quien recibe puede LEER los cobros y pagos del dueño (solo SELECT: escribir sigue siendo del dueño).
create policy "receivable_entries: ver los compartidos conmigo" on public.receivable_entries
  for select to authenticated
  using (exists (
    select 1 from public.receivable_shares s
    where s.user_id = receivable_entries.user_id
      and s.viewer_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  ));

-- Libretas que alguien compartió conmigo: dueño, su nombre y el nombre del botón.
-- SECURITY DEFINER porque profiles solo deja ver el propio perfil y el de mi hogar.
create function public.ledgers_shared_with_me()
returns table (owner_id uuid, owner_name text, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, p.display_name, s.label
  from public.receivable_shares s
  join public.profiles p on p.id = s.user_id
  where s.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by s.created_at
$$;

revoke execute on all functions in schema public, private from public, anon;
grant execute on function public.ledgers_shared_with_me() to authenticated;

grant select, delete on public.receivable_shares to authenticated;
grant insert (viewer_email, label) on public.receivable_shares to authenticated;
grant update (viewer_email, label) on public.receivable_shares to authenticated;
