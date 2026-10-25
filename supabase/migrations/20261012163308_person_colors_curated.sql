-- BULLMILTON · Colores de persona: solo los cuatro que se distinguen entre sí
--
-- La paleta final (src/styles/tokens.css, comprobada en src/styles/tokens.test.ts) quedó en
-- azul, ámbar, rosa y cian: naranja y violeta se confundían con el rojo del dinero o con el azul.
-- Quien ya los hubiera elegido vuelve al color automático.

update public.profiles set person_color = null where person_color in ('naranja', 'violeta');

alter table public.profiles drop constraint profiles_person_color_check;
alter table public.profiles
  add constraint profiles_person_color_check
    check (person_color is null or person_color in ('azul', 'ambar', 'rosa', 'cian'));

revoke execute on all functions in schema public, private from public, anon;
