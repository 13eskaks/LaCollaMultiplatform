-- =====================================================
-- LACOLLA · MIGRACIÓ PRINCIPAL
-- Executa aquest fitxer a Supabase SQL Editor
-- =====================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =====================
-- ENUMS
-- =====================

create type membre_rol as enum ('president', 'secretari', 'tresorer', 'junta', 'membre', 'convidat');
create type membre_estat as enum ('actiu', 'inactiu', 'pendent');
create type colla_estat as enum ('pendent', 'activa', 'suspesa', 'eliminada');
create type connexio_estat as enum ('pendent', 'acceptada', 'rebutjada');
create type rsvp_estat as enum ('apuntat', 'no_vinc', 'pendent');
create type acompanyant_relacio as enum ('familiar', 'parella', 'amic', 'altre');
create type votacio_tipus as enum ('si_no', 'opcions_multiples', 'puntuacio');
create type premium_tipus as enum ('individual', 'colla');
create type premium_periode as enum ('mensual', 'anual');

-- =====================
-- PROFILES
-- =====================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  cognoms text,
  sobrenom text,
  email text not null,
  telefon text,
  localitat text,
  bio text,
  avatar_url text,
  language text default 'ca' check (language in ('ca', 'es', 'en')),
  show_telefon boolean default false,
  visible_directori boolean default false,
  rep_missatges_altres_colles boolean default false,
  is_superadmin boolean default false,
  beta_user boolean default false,
  max_colles int default 2,
  expo_push_token text,
  deleted_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz default now()
);

-- Trigger per crear el perfil automàticament en registrar-se
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, nom, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================
-- COLLES
-- =====================

create table colles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text unique,
  descripcio text,
  localitat text,
  comarca text,
  any_fundacio int,
  avatar_url text,
  portada_url text,
  web text,
  instagram text,
  facebook text,
  whatsapp text,
  tiktok text,
  youtube text,
  telegram text,
  is_premium boolean default false,
  premium_until timestamptz,
  estat colla_estat default 'pendent',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Auto-generar slug
create or replace function generate_colla_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter int := 0;
begin
  base_slug := lower(regexp_replace(
    translate(new.nom, 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiioooooouuuucn'),
    '[^a-z0-9\s]', '', 'g'
  ));
  base_slug := regexp_replace(trim(base_slug), '\s+', '-', 'g');
  final_slug := base_slug;

  while exists (select 1 from colles where slug = final_slug and id != new.id) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;

  new.slug := final_slug;
  return new;
end;
$$ language plpgsql;

create trigger set_colla_slug
  before insert or update of nom on colles
  for each row execute function generate_colla_slug();

-- =====================
-- COLLA CONFIG
-- =====================

create table colla_config (
  colla_id uuid primary key references colles(id) on delete cascade,
  qui_pot_crear_events text default 'membres' check (qui_pot_crear_events in ('membres', 'comissio')),
  qui_pot_crear_votacions text default 'membres' check (qui_pot_crear_votacions in ('membres', 'comissio')),
  qui_pot_crear_fils text default 'membres' check (qui_pot_crear_fils in ('membres', 'comissio')),
  qui_pot_pujar_fotos text default 'membres' check (qui_pot_pujar_fotos in ('membres', 'comissio')),
  aprovacio_manual boolean default true,
  perfil_public boolean default true,
  events_globals_visibles boolean default true,
  mostrar_events_publics boolean default true,
  mostrar_fotos_publiques boolean default true,
  mostrar_anuncis_publics boolean default true,
  limit_fotos int default 500,
  limit_membres int default 100,
  updated_at timestamptz default now()
);

-- Crear config automàticament en crear colla
create or replace function create_colla_config()
returns trigger as $$
begin
  insert into colla_config (colla_id) values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger on_colla_created
  after insert on colles
  for each row execute function create_colla_config();

-- =====================
-- MEMBRES DE COLLA
-- =====================

create table colla_membres (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rol membre_rol not null default 'membre',
  estat membre_estat not null default 'actiu',
  data_ingres date default current_date,
  unique(colla_id, user_id)
);

-- Trigger: límit de colles per usuari
create or replace function check_max_colles()
returns trigger as $$
declare
  colles_actuals int;
  limit_colles int;
begin
  select count(*) into colles_actuals
  from colla_membres
  where user_id = new.user_id
    and estat in ('actiu', 'pendent');

  select max_colles into limit_colles
  from profiles where id = new.user_id;

  if colles_actuals >= limit_colles then
    raise exception 'Has arribat al límit de colles (%). Actualitza a Premium per ampliar-lo.', limit_colles;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trigger_max_colles
  before insert on colla_membres
  for each row execute function check_max_colles();

-- =====================
-- CONNEXIONS ENTRE COLLES
-- =====================

create table colla_connexions (
  id uuid primary key default gen_random_uuid(),
  colla_origen_id uuid references colles(id) on delete cascade,
  colla_desti_id uuid references colles(id) on delete cascade,
  estat connexio_estat default 'pendent',
  created_at timestamptz default now(),
  unique(colla_origen_id, colla_desti_id)
);

-- =====================
-- EVENTS
-- =====================

create table events (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  created_by uuid references profiles(id),
  titol text not null,
  descripcio text,
  imatge_url text,
  data_inici timestamptz not null,
  data_fi timestamptz,
  lloc text,
  permet_rsvp boolean default true,
  permet_convidats_externs boolean default false,
  limit_places int,
  obert_global boolean default false,
  notificar_membres boolean default true,
  created_at timestamptz default now()
);

create table event_rsvp (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  estat rsvp_estat default 'apuntat',
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

create table event_acompanyants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  nom text not null,
  telefon text,
  relacio acompanyant_relacio default 'altre',
  confirmat boolean default false
);

create table event_cotxes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  conductor_id uuid not null references profiles(id) on delete cascade,
  model text,
  color text,
  places_totals int not null,
  punt_trobada text,
  hora_sortida time
);

create table event_cotxe_passatgers (
  cotxe_id uuid references event_cotxes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key(cotxe_id, user_id)
);

-- =====================
-- ANUNCIS DE COLLA
-- =====================

create table anuncis (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  autor_id uuid references profiles(id),
  titol text,
  cos text not null,
  fixat boolean default false,
  public boolean default false,
  created_at timestamptz default now()
);

-- =====================
-- VOTACIONS
-- =====================

create table votacions (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  autor_id uuid references profiles(id),
  pregunta text not null,
  descripcio text,
  tipus votacio_tipus default 'si_no',
  vots_anonims boolean default false,
  permet_comentaris boolean default true,
  mostrar_resultats_temps_real boolean default true,
  qui_pot_votar text default 'tots' check (qui_pot_votar in ('tots', 'junta')),
  data_limit timestamptz,
  created_at timestamptz default now()
);

create table votacio_opcions (
  id uuid primary key default gen_random_uuid(),
  votacio_id uuid not null references votacions(id) on delete cascade,
  text text not null,
  ordre int default 0
);

create table votacio_vots (
  id uuid primary key default gen_random_uuid(),
  votacio_id uuid not null references votacions(id) on delete cascade,
  opcio_id uuid references votacio_opcions(id),
  user_id uuid references profiles(id),
  puntuacio int,
  created_at timestamptz default now(),
  unique(votacio_id, user_id)
);

create table votacio_comentaris (
  id uuid primary key default gen_random_uuid(),
  votacio_id uuid not null references votacions(id) on delete cascade,
  user_id uuid references profiles(id),
  text text not null,
  created_at timestamptz default now()
);

-- =====================
-- TORNS DE NETEJA
-- =====================

create table torns_neteja (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  setmana_inici date not null,
  setmana_fi date not null,
  fet boolean default false,
  signed_at timestamptz
);

create table torn_membres (
  torn_id uuid references torns_neteja(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key(torn_id, user_id)
);

-- =====================
-- FÒRUM
-- =====================

create table forum_fils (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  autor_id uuid references profiles(id),
  titol text not null,
  fixat boolean default false,
  created_at timestamptz default now()
);

create table forum_missatges (
  id uuid primary key default gen_random_uuid(),
  fil_id uuid not null references forum_fils(id) on delete cascade,
  autor_id uuid references profiles(id),
  text text not null,
  created_at timestamptz default now()
);

-- =====================
-- FOTOS
-- =====================

create table albums (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  nom text not null,
  emoji text,
  event_id uuid references events(id),
  created_at timestamptz default now()
);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  album_id uuid references albums(id),
  uploaded_by uuid references profiles(id),
  url text not null,
  publica boolean default false,
  created_at timestamptz default now()
);

-- =====================
-- CAIXA COMPARTIDA
-- =====================

create table despeses (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  pagat_per uuid references profiles(id),
  event_id uuid references events(id),
  descripcio text not null,
  emoji text,
  import numeric(10,2) not null,
  data date default current_date,
  created_at timestamptz default now()
);

create table despesa_participants (
  despesa_id uuid references despeses(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  import_proporcional numeric(10,2),
  liquidat boolean default false,
  primary key(despesa_id, user_id)
);

-- =====================
-- PRESSUPOST / COMISSIÓ
-- =====================

create table pressupost_categories (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  nom text not null,
  emoji text,
  import_mensual numeric(10,2) default 0,
  percentatge numeric(5,2)
);

-- =====================
-- QUOTES
-- =====================

create table quotes (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  titol text not null,
  import numeric(10,2) not null,
  termini date,
  descripcio text,
  created_at timestamptz default now()
);

create table quota_pagaments (
  id uuid primary key default gen_random_uuid(),
  quota_id uuid not null references quotes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  pagat boolean default false,
  pagat_at timestamptz,
  unique(quota_id, user_id)
);

-- =====================
-- ACTES DE REUNIÓ
-- =====================

create table actes (
  id uuid primary key default gen_random_uuid(),
  colla_id uuid not null references colles(id) on delete cascade,
  event_id uuid references events(id),
  titol text not null,
  contingut text,
  autor_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- PREMIUM / SUBSCRIPCIONS
-- =====================

create table premium_tramos (
  id uuid primary key default gen_random_uuid(),
  membres_min int not null,
  membres_max int,
  preu_mensual numeric(10,2) not null,
  preu_anual numeric(10,2) not null
);

insert into premium_tramos (membres_min, membres_max, preu_mensual, preu_anual) values
  (1,   20,  9.99,  89.99),
  (21,  60,  17.99, 161.99),
  (61,  100, 27.99, 251.99),
  (101, 200, 44.99, 404.99);

create table subscripcions (
  id uuid primary key default gen_random_uuid(),
  tipus premium_tipus not null,
  user_id uuid references profiles(id),
  colla_id uuid references colles(id),
  periode premium_periode not null,
  import numeric(10,2) not null,
  tramo_id uuid references premium_tramos(id),
  membres_al_contractar int,
  revenuecat_id text,
  stripe_subscription_id text,
  activa boolean default true,
  inici timestamptz default now(),
  fi timestamptz,
  created_at timestamptz default now()
);

-- Funció: obtenir tramo correcte
create or replace function get_tramo_colla(p_colla_id uuid)
returns uuid as $$
declare
  num_membres int;
  tramo_id uuid;
begin
  select count(*) into num_membres
  from colla_membres
  where colla_id = p_colla_id and estat = 'actiu';

  select id into tramo_id
  from premium_tramos
  where membres_min <= num_membres
    and (membres_max is null or membres_max >= num_membres)
  order by membres_min desc
  limit 1;

  return tramo_id;
end;
$$ language plpgsql;

-- =====================
-- ANUNCIS COMERCIALS
-- =====================

create table anuncis_comercials (
  id uuid primary key default gen_random_uuid(),
  anunciant text not null,
  imatge_url text not null,
  url_desti text,
  comarques text[] default '{}',
  actiu boolean default true,
  data_inici date,
  data_fi date,
  impressions int default 0,
  clicks int default 0,
  created_at timestamptz default now()
);

-- =====================
-- ADMIN
-- =====================

create table admin_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  accio text not null,
  entitat_tipus text,
  entitat_id uuid,
  detall jsonb,
  created_at timestamptz default now()
);

create table beta_comunicats (
  id uuid primary key default gen_random_uuid(),
  assumpte text not null,
  cos text not null,
  enviat_at timestamptz,
  enviat_per uuid references profiles(id)
);

-- =====================
-- ÍNDEXOS
-- =====================

create index idx_colla_membres_user_id on colla_membres(user_id);
create index idx_colla_membres_colla_id on colla_membres(colla_id);
create index idx_colla_membres_estat on colla_membres(estat);
create index idx_events_colla_id on events(colla_id);
create index idx_events_data_inici on events(data_inici);
create index idx_events_obert_global on events(obert_global) where obert_global = true;
create index idx_forum_fils_colla_id on forum_fils(colla_id);
create index idx_forum_missatges_fil_id on forum_missatges(fil_id);
create index idx_fotos_colla_id on fotos(colla_id);
create index idx_anuncis_comercials_actiu on anuncis_comercials(actiu) where actiu = true;
create index idx_colles_slug on colles(slug);
create index idx_colles_estat on colles(estat);
create index idx_profiles_deleted on profiles(deleted_at) where deleted_at is null;
