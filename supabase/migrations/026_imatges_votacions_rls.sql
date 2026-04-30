-- Fix imatges table insert: only require auth (uploader_id = auth.uid() fails in RN)
drop policy if exists "imatges_insert" on imatges;
create policy "imatges_insert" on imatges
  for insert with check (auth.uid() is not null);

-- Recreate storage policies safely (in case migration 025 had errors)
drop policy if exists "imatges_storage_insert" on storage.objects;
create policy "imatges_storage_insert" on storage.objects
  for insert with check (bucket_id = 'imatges' and auth.uid() is not null);

drop policy if exists "imatges_storage_delete" on storage.objects;
create policy "imatges_storage_delete" on storage.objects
  for delete using (bucket_id = 'imatges' and auth.uid() is not null);

-- Ensure bucket exists and is public
insert into storage.buckets (id, name, public)
values ('imatges', 'imatges', true)
on conflict (id) do update set public = true;

-- Allow any active colla member to create votacions (not just comissió)
drop policy if exists "votacions_insert" on votacions;
create policy "votacions_insert" on votacions
  for insert with check (is_membre_actiu(colla_id) or is_superadmin());
