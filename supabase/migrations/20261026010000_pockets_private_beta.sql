-- Freyapp · Bolsillos y «Mamá me debe» solo para cuentas autorizadas (pedido del usuario, 2026-10-25)
--
-- profiles.pockets_enabled: interruptor por cuenta. Nadie lo puede cambiar desde la app (no hay
-- GRANT de columna para authenticated); se activa desde el editor SQL de Supabase:
--   update public.profiles set pockets_enabled = true
--   where id = (select id from auth.users where email = '<correo de la cuenta>');
--
-- Además de ocultar las pantallas, la base de datos rechaza crear datos de estas tablas si la cuenta
-- no lo tiene activado (políticas RESTRICTIVE de INSERT).

alter table public.profiles
  add column pockets_enabled boolean not null default false;

create policy "pockets: solo cuentas autorizadas" on public.pockets
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.pockets_enabled
  ));
create policy "pocket_moves: solo cuentas autorizadas" on public.pocket_moves
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.pockets_enabled
  ));
create policy "receivable_rules: solo cuentas autorizadas" on public.receivable_rules
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.pockets_enabled
  ));
create policy "receivable_entries: solo cuentas autorizadas" on public.receivable_entries
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.pockets_enabled
  ));

revoke execute on all functions in schema public, private from public, anon;
