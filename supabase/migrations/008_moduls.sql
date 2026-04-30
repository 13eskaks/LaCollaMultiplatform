-- =====================================================
-- LACOLLA · MÒDULS PER COLLA
-- Afegeix moduls_actius a colla_config
-- =====================================================

alter table colla_config
  add column if not exists moduls_actius text[]
  not null default array[
    'anuncis','votacions','torns','llocs','membres',
    'caixa','quotes','fotos','actes','pressupost','connexions'
  ]::text[];
