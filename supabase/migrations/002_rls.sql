-- =====================================================
-- LACOLLA · ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Helper function: comprova si l'usuari és membre actiu d'una colla
create or replace function is_membre_actiu(p_colla_id uuid)
returns boolean as $$
  select exists (
    select 1 from colla_membres
    where colla_id = p_colla_id
      and user_id = auth.uid()
      and estat = 'actiu'
  );
$$ language sql security definer stable;

-- Helper function: comprova si l'usuari és comissió d'una colla
create or replace function is_comissio(p_colla_id uuid)
returns boolean as $$
  select exists (
    select 1 from colla_membres
    where colla_id = p_colla_id
      and user_id = auth.uid()
      and estat = 'actiu'
      and rol in ('president', 'secretari', 'tresorer', 'junta')
  );
$$ language sql security definer stable;

-- Helper function: comprova si és superadmin
create or replace function is_superadmin()
returns boolean as $$
  select coalesce(
    (select is_superadmin from profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- =====================
-- PROFILES
-- =====================

alter table profiles enable row level security;

-- Tothom pot veure perfils bàsics de membres de la seua colla
create policy "profiles_select" on profiles for select
  using (
    id = auth.uid()
    or is_superadmin()
    or exists (
      select 1 from colla_membres cm1
      join colla_membres cm2 on cm1.colla_id = cm2.colla_id
      where cm1.user_id = auth.uid()
        and cm2.user_id = profiles.id
        and cm1.estat = 'actiu'
        and cm2.estat = 'actiu'
    )
  );

create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_superadmin());

-- =====================
-- COLLES
-- =====================

alter table colles enable row level security;

-- Colles públiques (actives amb perfil_public) visible a tothom
create policy "colles_select_public" on colles for select
  using (
    (estat = 'activa' and exists (
      select 1 from colla_config cc
      where cc.colla_id = colles.id and cc.perfil_public = true
    ))
    or is_membre_actiu(id)
    or is_superadmin()
  );

create policy "colles_insert" on colles for insert
  with check (auth.uid() is not null);

create policy "colles_update" on colles for update
  using (is_comissio(id) or is_superadmin());

-- =====================
-- COLLA CONFIG
-- =====================

alter table colla_config enable row level security;

create policy "colla_config_select" on colla_config for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "colla_config_update" on colla_config for update
  using (is_comissio(colla_id) or is_superadmin());

-- =====================
-- COLLA MEMBRES
-- =====================

alter table colla_membres enable row level security;

create policy "colla_membres_select" on colla_membres for select
  using (
    user_id = auth.uid()
    or is_membre_actiu(colla_id)
    or is_superadmin()
  );

-- Qualsevol autenticat pot sol·licitar unir-se (insertar pendent)
create policy "colla_membres_insert" on colla_membres for insert
  with check (
    user_id = auth.uid() and estat = 'pendent'
    or is_comissio(colla_id)
    or is_superadmin()
  );

-- Només comissió pot aprovar/canviar rols
create policy "colla_membres_update" on colla_membres for update
  using (is_comissio(colla_id) or user_id = auth.uid() or is_superadmin());

create policy "colla_membres_delete" on colla_membres for delete
  using (is_comissio(colla_id) or user_id = auth.uid() or is_superadmin());

-- =====================
-- EVENTS
-- =====================

alter table events enable row level security;

-- Events globals visibles per a tothom; interns només per membres actius
create policy "events_select" on events for select
  using (
    obert_global = true
    or is_membre_actiu(colla_id)
    or is_superadmin()
  );

create policy "events_insert" on events for insert
  with check (
    is_membre_actiu(colla_id)
    and (
      is_comissio(colla_id)
      or (select qui_pot_crear_events from colla_config where colla_id = events.colla_id) = 'membres'
    )
  );

create policy "events_update" on events for update
  using (
    created_by = auth.uid()
    or is_comissio(colla_id)
    or is_superadmin()
  );

create policy "events_delete" on events for delete
  using (is_comissio(colla_id) or is_superadmin());

-- =====================
-- EVENT RSVP
-- =====================

alter table event_rsvp enable row level security;

create policy "event_rsvp_select" on event_rsvp for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from events e where e.id = event_rsvp.event_id
      and is_membre_actiu(e.colla_id)
    )
    or is_superadmin()
  );

create policy "event_rsvp_insert" on event_rsvp for insert
  with check (user_id = auth.uid());

create policy "event_rsvp_update" on event_rsvp for update
  using (user_id = auth.uid());

create policy "event_rsvp_delete" on event_rsvp for delete
  using (user_id = auth.uid());

-- =====================
-- ANUNCIS DE COLLA
-- =====================

alter table anuncis enable row level security;

create policy "anuncis_select" on anuncis for select
  using (
    public = true
    or is_membre_actiu(colla_id)
    or is_superadmin()
  );

create policy "anuncis_insert" on anuncis for insert
  with check (is_comissio(colla_id) or is_superadmin());

create policy "anuncis_update" on anuncis for update
  using (is_comissio(colla_id) or is_superadmin());

create policy "anuncis_delete" on anuncis for delete
  using (is_comissio(colla_id) or is_superadmin());

-- =====================
-- VOTACIONS
-- =====================

alter table votacions enable row level security;

create policy "votacions_select" on votacions for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "votacions_insert" on votacions for insert
  with check (
    is_membre_actiu(colla_id)
    and (
      is_comissio(colla_id)
      or (select qui_pot_crear_votacions from colla_config where colla_id = votacions.colla_id) = 'membres'
    )
  );

create policy "votacions_update" on votacions for update
  using (is_comissio(colla_id) or is_superadmin());

-- Vots: visibles només si no són anònims o és el propi vot
alter table votacio_vots enable row level security;

create policy "votacio_vots_select" on votacio_vots for select
  using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from votacions v
        where v.id = votacio_vots.votacio_id
          and v.vots_anonims = false
          and is_membre_actiu(v.colla_id)
      )
    )
    or is_superadmin()
  );

-- Els vots s'insertan via Edge Function per controlar l'anonimat
create policy "votacio_vots_insert" on votacio_vots for insert
  with check (user_id = auth.uid());

-- =====================
-- FÒRUM
-- =====================

alter table forum_fils enable row level security;

create policy "forum_fils_select" on forum_fils for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "forum_fils_insert" on forum_fils for insert
  with check (
    is_membre_actiu(colla_id)
    and (
      is_comissio(colla_id)
      or (select qui_pot_crear_fils from colla_config where colla_id = forum_fils.colla_id) = 'membres'
    )
  );

create policy "forum_fils_update" on forum_fils for update
  using (autor_id = auth.uid() or is_comissio(colla_id) or is_superadmin());

create policy "forum_fils_delete" on forum_fils for delete
  using (autor_id = auth.uid() or is_comissio(colla_id) or is_superadmin());

alter table forum_missatges enable row level security;

create policy "forum_missatges_select" on forum_missatges for select
  using (
    exists (
      select 1 from forum_fils f
      where f.id = forum_missatges.fil_id
        and is_membre_actiu(f.colla_id)
    )
    or is_superadmin()
  );

create policy "forum_missatges_insert" on forum_missatges for insert
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from forum_fils f
      where f.id = fil_id and is_membre_actiu(f.colla_id)
    )
  );

create policy "forum_missatges_update" on forum_missatges for update
  using (autor_id = auth.uid() or is_superadmin());

create policy "forum_missatges_delete" on forum_missatges for delete
  using (
    autor_id = auth.uid()
    or exists (
      select 1 from forum_fils f
      where f.id = fil_id and is_comissio(f.colla_id)
    )
    or is_superadmin()
  );

-- =====================
-- FOTOS
-- =====================

alter table fotos enable row level security;

create policy "fotos_select" on fotos for select
  using (
    publica = true
    or is_membre_actiu(colla_id)
    or is_superadmin()
  );

create policy "fotos_insert" on fotos for insert
  with check (
    uploaded_by = auth.uid()
    and is_membre_actiu(colla_id)
    and (
      is_comissio(colla_id)
      or (select qui_pot_pujar_fotos from colla_config where colla_id = fotos.colla_id) = 'membres'
    )
  );

create policy "fotos_delete" on fotos for delete
  using (uploaded_by = auth.uid() or is_comissio(colla_id) or is_superadmin());

-- =====================
-- CAIXA COMPARTIDA
-- =====================

alter table despeses enable row level security;

create policy "despeses_select" on despeses for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "despeses_insert" on despeses for insert
  with check (is_membre_actiu(colla_id));

create policy "despeses_update" on despeses for update
  using (pagat_per = auth.uid() or is_comissio(colla_id) or is_superadmin());

create policy "despeses_delete" on despeses for delete
  using (pagat_per = auth.uid() or is_comissio(colla_id) or is_superadmin());

-- =====================
-- PRESSUPOST
-- =====================

alter table pressupost_categories enable row level security;

create policy "pressupost_select" on pressupost_categories for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "pressupost_insert" on pressupost_categories for insert
  with check (is_comissio(colla_id) or is_superadmin());

create policy "pressupost_update" on pressupost_categories for update
  using (is_comissio(colla_id) or is_superadmin());

create policy "pressupost_delete" on pressupost_categories for delete
  using (is_comissio(colla_id) or is_superadmin());

-- =====================
-- QUOTES
-- =====================

alter table quotes enable row level security;

create policy "quotes_select" on quotes for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "quotes_insert" on quotes for insert
  with check (is_comissio(colla_id) or is_superadmin());

alter table quota_pagaments enable row level security;

create policy "quota_pagaments_select" on quota_pagaments for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from quotes q
      where q.id = quota_pagaments.quota_id and is_comissio(q.colla_id)
    )
    or is_superadmin()
  );

-- =====================
-- TORNS NETEJA
-- =====================

alter table torns_neteja enable row level security;

create policy "torns_select" on torns_neteja for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "torns_insert" on torns_neteja for insert
  with check (is_comissio(colla_id) or is_superadmin());

create policy "torns_update" on torns_neteja for update
  using (is_membre_actiu(colla_id) or is_superadmin());

-- =====================
-- ACTES
-- =====================

alter table actes enable row level security;

create policy "actes_select" on actes for select
  using (is_membre_actiu(colla_id) or is_superadmin());

create policy "actes_insert" on actes for insert
  with check (is_comissio(colla_id) or is_superadmin());

create policy "actes_update" on actes for update
  using (is_comissio(colla_id) or is_superadmin());

-- =====================
-- ANUNCIS COMERCIALS
-- Llegibles per tothom, editables només per superadmin
-- =====================

alter table anuncis_comercials enable row level security;

create policy "anuncis_comercials_select" on anuncis_comercials for select
  using (actiu = true or is_superadmin());

create policy "anuncis_comercials_all" on anuncis_comercials for all
  using (is_superadmin());

-- =====================
-- ADMIN LOG
-- Només superadmin
-- =====================

alter table admin_log enable row level security;

create policy "admin_log_all" on admin_log for all
  using (is_superadmin());

-- =====================
-- PREMIUM TRAMOS
-- Llegibles per tothom
-- =====================

alter table premium_tramos enable row level security;

create policy "premium_tramos_select" on premium_tramos for select
  using (true);

-- =====================
-- SUBSCRIPCIONS
-- =====================

alter table subscripcions enable row level security;

create policy "subscripcions_select" on subscripcions for select
  using (
    user_id = auth.uid()
    or is_comissio(colla_id)
    or is_superadmin()
  );
