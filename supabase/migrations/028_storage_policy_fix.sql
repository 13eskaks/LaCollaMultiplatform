-- Use TO authenticated syntax so the role-check is explicit and unambiguous
drop policy if exists "imatges_storage_insert" on storage.objects;
create policy "imatges_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imatges');

drop policy if exists "imatges_storage_update" on storage.objects;
create policy "imatges_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'imatges');

drop policy if exists "imatges_storage_select" on storage.objects;
create policy "imatges_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'imatges');
