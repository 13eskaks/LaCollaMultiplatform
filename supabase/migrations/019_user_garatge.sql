create table user_garatge (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  model text,
  color text not null default '#3b82f6',
  places_totals smallint not null default 3,
  created_at timestamptz default now()
);

alter table user_garatge enable row level security;

create policy "garatge_own" on user_garatge
  for all using (auth.uid() = user_id);
