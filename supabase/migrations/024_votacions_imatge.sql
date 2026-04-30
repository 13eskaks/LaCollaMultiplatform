alter table votacions add column if not exists imatge_url text;

insert into storage.buckets (id, name, public)
values ('votacions', 'votacions', true)
on conflict (id) do update set public = true;

create policy "votacions_media_insert" on storage.objects for insert
  with check (
    bucket_id = 'votacions'
    and auth.uid() is not null
    and is_membre_actiu((storage.foldername(name))[1]::uuid)
  );

create policy "votacions_media_delete" on storage.objects for delete
  using (
    bucket_id = 'votacions'
    and auth.uid() is not null
  );
