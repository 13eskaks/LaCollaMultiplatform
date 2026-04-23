// =====================
// ENUMS
// =====================

export type MembreRol = 'president' | 'secretari' | 'tresorer' | 'junta' | 'membre' | 'convidat'
export type MembreEstat = 'actiu' | 'inactiu' | 'pendent'
export type CollaEstat = 'pendent' | 'activa' | 'suspesa' | 'eliminada'
export type ConnexioEstat = 'pendent' | 'acceptada' | 'rebutjada'
export type RsvpEstat = 'apuntat' | 'no_vinc' | 'pendent'
export type AcompanyantRelacio = 'familiar' | 'parella' | 'amic' | 'altre'
export type VotacioTipus = 'si_no' | 'opcions_multiples' | 'puntuacio'
export type PremiumTipus = 'individual' | 'colla'
export type PremiumPeriode = 'mensual' | 'anual'
export type Language = 'ca' | 'es' | 'en'

// =====================
// PROFILES
// =====================

export interface Profile {
  id: string
  nom: string
  cognoms: string | null
  sobrenom: string | null
  email: string
  telefon: string | null
  localitat: string | null
  bio: string | null
  avatar_url: string | null
  language: Language
  show_telefon: boolean
  visible_directori: boolean
  rep_missatges_altres_colles: boolean
  is_superadmin: boolean
  beta_user: boolean
  max_colles: number
  expo_push_token: string | null
  deleted_at: string | null
  deletion_requested_at: string | null
  created_at: string
}

// =====================
// COLLES
// =====================

export interface Colla {
  id: string
  nom: string
  descripcio: string | null
  localitat: string | null
  any_fundacio: number | null
  avatar_url: string | null
  portada_url: string | null
  web: string | null
  instagram: string | null
  facebook: string | null
  whatsapp: string | null
  tiktok: string | null
  youtube: string | null
  telegram: string | null
  is_premium: boolean
  premium_until: string | null
  estat: CollaEstat
  created_at: string
}

export interface CollaConfig {
  colla_id: string
  qui_pot_crear_events: 'membres' | 'comissio'
  qui_pot_crear_votacions: 'membres' | 'comissio'
  qui_pot_crear_fils: 'membres' | 'comissio'
  qui_pot_pujar_fotos: 'membres' | 'comissio'
  aprovacio_manual: boolean
  perfil_public: boolean
  events_globals_visibles: boolean
  mostrar_events_publics: boolean
  mostrar_fotos_publiques: boolean
  mostrar_anuncis_publics: boolean
  limit_fotos: number | null
  limit_membres: number
  updated_at: string
}

export interface CollaMembre {
  id: string
  colla_id: string
  user_id: string
  rol: MembreRol
  estat: MembreEstat
  data_ingres: string
  // joins
  profile?: Profile
  colla?: Colla
}

// =====================
// EVENTS
// =====================

export interface Event {
  id: string
  colla_id: string
  created_by: string | null
  titol: string
  descripcio: string | null
  imatge_url: string | null
  data_inici: string
  data_fi: string | null
  lloc: string | null
  permet_rsvp: boolean
  permet_convidats_externs: boolean
  limit_places: number | null
  obert_global: boolean
  notificar_membres: boolean
  created_at: string
  // joins
  rsvp_count?: number
  user_rsvp?: RsvpEstat | null
}

export interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  estat: RsvpEstat
  created_at: string
}

export interface EventAcompanyant {
  id: string
  event_id: string
  user_id: string
  nom: string
  telefon: string | null
  relacio: AcompanyantRelacio
  confirmat: boolean
}

export interface EventCotxe {
  id: string
  event_id: string
  conductor_id: string
  model: string | null
  color: string | null
  places_totals: number
  punt_trobada: string | null
  hora_sortida: string | null
  // joins
  passatgers?: Profile[]
  conductor?: Profile
}

// =====================
// ANUNCIS (COLLA)
// =====================

export interface Anunci {
  id: string
  colla_id: string
  autor_id: string | null
  titol: string | null
  cos: string
  fixat: boolean
  public: boolean
  created_at: string
  autor?: Profile
}

// =====================
// VOTACIONS
// =====================

export interface Votacio {
  id: string
  colla_id: string
  autor_id: string | null
  pregunta: string
  descripcio: string | null
  tipus: VotacioTipus
  vots_anonims: boolean
  permet_comentaris: boolean
  mostrar_resultats_temps_real: boolean
  qui_pot_votar: 'tots' | 'junta'
  data_limit: string | null
  created_at: string
  // joins
  opcions?: VotacioOpcio[]
  total_vots?: number
  user_ha_votat?: boolean
}

export interface VotacioOpcio {
  id: string
  votacio_id: string
  text: string
  ordre: number
  vots?: number
  percentatge?: number
}

export interface VotacioComentari {
  id: string
  votacio_id: string
  user_id: string
  text: string
  created_at: string
  autor?: Profile
}

// =====================
// TORNS DE NETEJA
// =====================

export interface TornNeteja {
  id: string
  colla_id: string
  setmana_inici: string
  setmana_fi: string
  fet: boolean
  signed_at: string | null
  membres?: Profile[]
}

// =====================
// FÒRUM
// =====================

export interface ForumFil {
  id: string
  colla_id: string
  autor_id: string | null
  titol: string
  fixat: boolean
  created_at: string
  autor?: Profile
  num_missatges?: number
  darrer_missatge?: string
}

export interface ForumMissatge {
  id: string
  fil_id: string
  autor_id: string | null
  text: string
  created_at: string
  autor?: Profile
}

// =====================
// FOTOS
// =====================

export interface Album {
  id: string
  colla_id: string
  nom: string
  emoji: string | null
  event_id: string | null
  created_at: string
  num_fotos?: number
}

export interface Foto {
  id: string
  colla_id: string
  album_id: string | null
  uploaded_by: string | null
  url: string
  publica: boolean
  created_at: string
}

// =====================
// CAIXA COMPARTIDA
// =====================

export interface Despesa {
  id: string
  colla_id: string
  pagat_per: string | null
  event_id: string | null
  descripcio: string
  emoji: string | null
  import: number
  data: string
  created_at: string
  pagador?: Profile
  participants?: DespesaParticipant[]
}

export interface DespesaParticipant {
  despesa_id: string
  user_id: string
  import_proporcional: number
  liquidat: boolean
  profile?: Profile
}

export interface BalancPersonal {
  user_id: string
  total_pagat: number
  total_deu: number
  balanc: number // positiu = li deuen, negatiu = deu
  profile?: Profile
}

// =====================
// PREMIUM
// =====================

export interface PremiumTramo {
  id: string
  membres_min: number
  membres_max: number | null
  preu_mensual: number
  preu_anual: number
}

export interface Subscripcio {
  id: string
  tipus: PremiumTipus
  user_id: string | null
  colla_id: string | null
  periode: PremiumPeriode
  import: number
  tramo_id: string | null
  membres_al_contractar: number | null
  revenuecat_id: string | null
  stripe_subscription_id: string | null
  activa: boolean
  inici: string
  fi: string | null
  created_at: string
}

// =====================
// ANUNCIS COMERCIALS
// =====================

export interface AnunciComercial {
  id: string
  anunciant: string
  imatge_url: string
  url_desti: string | null
  comarques: string[]
  actiu: boolean
  data_inici: string | null
  data_fi: string | null
  impressions: number
  clicks: number
  created_at: string
}

// =====================
// CONNEXIONS ENTRE COLLES
// =====================

export interface CollaConnexio {
  id: string
  colla_origen_id: string
  colla_desti_id: string
  estat: ConnexioEstat
  created_at: string
  colla_origen?: Colla
  colla_desti?: Colla
}
