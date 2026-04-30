-- Add descripcio field for public colla landing
alter table colles add column if not exists descripcio text;

-- SECURITY DEFINER function so non-members can read the public member count
create or replace function get_colla_membres_count(p_colla_id uuid)
returns bigint as $$
  select count(*)::bigint from colla_membres
  where colla_id = p_colla_id and estat = 'actiu';
$$ language sql security definer stable;
