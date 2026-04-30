create table imatges (
  id uuid default gen_random_uuid() primary key,
  entity_type text not null check (entity_type in ('votacio', 'anunci', 'acta', 'event')),
  entity_id uuid not null,
  url text not null,
  ordre smallint default 0,
  uploader_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table imatges enable row level security;

create policy "imatges_select" on imatges for select using (auth.uid() is not null);
create policy "imatges_insert" on imatges for insert with check (auth.uid() = uploader_id);
create policy "imatges_delete" on imatges for delete using (auth.uid() = uploader_id);

insert into storage.buckets (id, name, public)
values ('imatges', 'imatges', true)
on conflict (id) do update set public = true;

create policy "imatges_storage_insert" on storage.objects for insert
  with check (bucket_id = 'imatges' and auth.uid() is not null);

create policy "imatges_storage_delete" on storage.objects for delete
  using (bucket_id = 'imatges' and auth.uid() is not null);
