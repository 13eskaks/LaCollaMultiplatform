-- Add created_at to event_cotxes (needed to remember user's last car)
alter table event_cotxes
  add column if not exists created_at timestamptz not null default now();

-- Enable RLS
alter table event_cotxes enable row level security;
alter table event_cotxe_passatgers enable row level security;

-- event_cotxes: qualsevol membre de la colla pot llegir
create policy "membres poden veure cotxes"
  on event_cotxes for select
  using (
    exists (
      select 1 from events e
      join colla_membres cm on cm.colla_id = e.colla_id
      where e.id = event_cotxes.event_id
        and cm.user_id = auth.uid()
    )
  );

-- event_cotxes: el conductor pot inserir el seu propi cotxe
create policy "conductor pot afegir cotxe"
  on event_cotxes for insert
  with check (conductor_id = auth.uid());

-- event_cotxes: el conductor pot eliminar el seu propi cotxe
create policy "conductor pot eliminar cotxe"
  on event_cotxes for delete
  using (conductor_id = auth.uid());

-- event_cotxe_passatgers: membres de la colla poden llegir
create policy "membres poden veure passatgers"
  on event_cotxe_passatgers for select
  using (
    exists (
      select 1 from event_cotxes ec
      join events e on e.id = ec.event_id
      join colla_membres cm on cm.colla_id = e.colla_id
      where ec.id = event_cotxe_passatgers.cotxe_id
        and cm.user_id = auth.uid()
    )
  );

-- event_cotxe_passatgers: cada usuari gestiona la seva pròpia fila
create policy "passatger pot afegir-se"
  on event_cotxe_passatgers for insert
  with check (user_id = auth.uid());

create policy "passatger pot sortir"
  on event_cotxe_passatgers for delete
  using (user_id = auth.uid());
