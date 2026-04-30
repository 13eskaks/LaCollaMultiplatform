-- =====================================================
-- LACOLLA · FOTOS & ÀLBUMS
-- Afegeix storage_path a fotos i RLS per a àlbums
-- =====================================================

alter table fotos add column if not exists storage_path text;

-- =====================
-- ÀLBUMS RLS
-- =====================

alter table albums enable row level security;

create policy "albums_select" on albums for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "albums_insert" on albums for insert
  with check (is_comissio(colla_id) or is_superadmin());

create policy "albums_update" on albums for update
  using (is_comissio(colla_id) or is_superadmin());

create policy "albums_delete" on albums for delete
  using (is_comissio(colla_id) or is_superadmin());

-- Índex per accelerar les consultes per colla
create index if not exists idx_albums_colla_id on albums(colla_id);
create index if not exists idx_fotos_album_id on fotos(album_id);
