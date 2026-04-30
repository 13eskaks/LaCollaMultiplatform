-- Rich landing content for colles
alter table colles add column if not exists landing_blocks jsonb;

-- Events visible on public colla landing
alter table events add column if not exists visible_extern boolean default false;

-- Allow anyone (even unauthenticated) to read publicly visible events
drop policy if exists "public_read_extern_events" on events;
create policy "public_read_extern_events"
  on events for select
  using (visible_extern = true);
