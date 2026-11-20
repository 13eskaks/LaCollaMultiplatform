-- =====================================================================
-- 038: correccions d'esquema detectades en revisar el codi de l'app
-- =====================================================================

-- Ubicació de la colla (settings.tsx la llegeix i desa)
alter table colles add column if not exists latitud double precision;
alter table colles add column if not exists longitud double precision;

-- Data de sol·licitud i motiu d'expulsió (settings.tsx / membres.tsx)
alter table colla_membres add column if not exists created_at timestamptz not null default now();
alter table colla_membres add column if not exists motiu_expulsio text;

-- Buckets que l'app fa servir però no existien
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('colles', 'colles', true)
on conflict (id) do update set public = true;

-- Avatars: cada usuari només a la seua carpeta <uid>/...
drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Imatges de colla (avatar/portada en crear-la): comissió de la colla
drop policy if exists "colles_bucket_insert" on storage.objects;
create policy "colles_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'colles' and (is_comissio((storage.foldername(name))[1]::uuid) or is_superadmin()));
drop policy if exists "colles_bucket_update" on storage.objects;
create policy "colles_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'colles' and (is_comissio((storage.foldername(name))[1]::uuid) or is_superadmin()));
drop policy if exists "colles_bucket_delete" on storage.objects;
create policy "colles_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'colles' and (is_comissio((storage.foldername(name))[1]::uuid) or is_superadmin()));

-- Lectura de metadades d'objectes de buckets públics (necessari per a RETURNING)
drop policy if exists "public_buckets_select" on storage.objects;
create policy "public_buckets_select" on storage.objects for select
  using (bucket_id in (select id from storage.buckets where public));
