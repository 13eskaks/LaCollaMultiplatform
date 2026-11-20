-- =====================================================================
-- 039: l'autor/creador s'omple automàticament amb l'usuari autenticat.
-- Diverses pantalles de l'app no l'enviaven (events, colles, llocs...),
-- i aleshores no es podia editar/esborrar "el que és meu".
-- =====================================================================
alter table actes                alter column autor_id    set default auth.uid();
alter table anuncis              alter column autor_id    set default auth.uid();
alter table caixa_moviments      alter column autor_id    set default auth.uid();
alter table caixa_periodics      alter column autor_id    set default auth.uid();
alter table colla_fotos          alter column autor_id    set default auth.uid();
alter table colla_llocs          alter column created_by  set default auth.uid();
alter table colles               alter column created_by  set default auth.uid();
alter table despeses_compartides alter column created_by  set default auth.uid();
alter table events               alter column created_by  set default auth.uid();
alter table forum_fils           alter column creador_id  set default auth.uid();
alter table fotos                alter column uploaded_by set default auth.uid();
alter table imatges              alter column uploader_id set default auth.uid();
alter table votacions            alter column creador_id  set default auth.uid();
