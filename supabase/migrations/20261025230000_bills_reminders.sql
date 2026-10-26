-- Freyapp · Recibos variables con tope y fechas de pago (pedido del usuario, 2026-10-25)
--
-- 1) plan_items.due_day / remind_days: día del mes en que hay que pagar la línea y cuántos días antes
--    avisar (por defecto 3). Sirve para cualquier línea del plan (recibos, gimnasio, suscripciones…).
-- 2) plan_entries.file_path / file_name: la foto o el PDF del recibo que se registró (bucket privado
--    freyapp-files, carpeta de cada persona).
--
-- Todo es privado (RLS por user_id, igual que plan_items y plan_entries).

alter table public.plan_items
  add column due_day int check (due_day is null or due_day between 1 and 31),
  add column remind_days int not null default 3 check (remind_days between 0 and 30);

alter table public.plan_entries
  add column file_path text check (file_path is null or file_path like user_id::text || '/%'),
  add column file_name text check (file_name is null or char_length(file_name) <= 200);

revoke execute on all functions in schema public, private from public, anon;

grant insert (due_day, remind_days) on public.plan_items to authenticated;
grant update (due_day, remind_days) on public.plan_items to authenticated;
grant insert (file_path, file_name) on public.plan_entries to authenticated;
grant update (file_path, file_name) on public.plan_entries to authenticated;
