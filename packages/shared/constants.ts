// =====================
// PREMIUM
// =====================

export const PREMIUM_INDIVIDUAL_MENSUAL = 4.99
export const PREMIUM_INDIVIDUAL_ANUAL = 39.99

export const PREMIUM_TRAMOS = [
  { membres_min: 1,   membres_max: 20,  preu_mensual: 9.99,  preu_anual: 89.99  },
  { membres_min: 21,  membres_max: 60,  preu_mensual: 17.99, preu_anual: 161.99 },
  { membres_min: 61,  membres_max: 100, preu_mensual: 27.99, preu_anual: 251.99 },
  { membres_min: 101, membres_max: 200, preu_mensual: 44.99, preu_anual: 404.99 },
] as const

// =====================
// LIMITS FREE
// =====================

export const FREE_MAX_COLLES = 2
export const PREMIUM_INDIVIDUAL_MAX_COLLES = 5
export const FREE_MAX_FOTOS_PER_COLLA = 500
export const FREE_MAX_MEMBRES_PER_COLLA = 100
export const PREMIUM_MAX_MEMBRES_PER_COLLA = 200

// =====================
// BETA
// =====================

export const BETA_DURATION_MONTHS = 6
export const POST_BETA_GRACE_DAYS = 30

// =====================
// COMARQUES VALENCIANES
// =====================

export const COMARQUES_VALENCIANES = [
  // País Valencià Nord
  'Els Ports', 'L\'Alt Maestrat', 'El Baix Maestrat', 'L\'Alcalatén',
  'La Plana Alta', 'La Plana Baixa',
  // País Valencià Centre
  'L\'Alt Palància', 'L\'Alt Millars', 'La Vall d\'Albaida',
  'El Camp de Morvedre', 'L\'Horta Nord', 'L\'Horta Oest', 'L\'Horta Sud',
  'València', 'El Camp de Túria', 'Els Serrans', 'La Ribera Alta',
  'La Ribera Baixa', 'La Costera', 'La Canal de Navarrés',
  'El Comtat', 'L\'Alcoià', 'El Marquès de Dos Aigues',
  // País Valencià Sud
  'La Safor', 'La Marina Alta', 'La Marina Baixa',
  'L\'Alacantí', 'El Vinalopó Mitjà', 'L\'Alt Vinalopó',
  'El Baix Vinalopó', 'El Baix Segura',
] as const

// =====================
// STORAGE PATHS
// =====================

export const STORAGE_PATHS = {
  collaAvatar: (collaId: string) => `colles/${collaId}/avatar`,
  collaPortada: (collaId: string) => `colles/${collaId}/portada`,
  userAvatar: (userId: string) => `profiles/${userId}/avatar`,
  foto: (collaId: string, albumId: string, fotoId: string) =>
    `fotos/${collaId}/${albumId}/${fotoId}`,
  eventImatge: (collaId: string, eventId: string) =>
    `events/${collaId}/${eventId}/portada`,
  anunciImatge: (anunciId: string) => `anuncis/${anunciId}/banner`,
} as const

// =====================
// ROLES AMB PERMISOS DE COMISSIÓ
// =====================

export const ROLS_COMISSIO = ['president', 'secretari', 'tresorer', 'junta'] as const

export function isComissio(rol: string): boolean {
  return ROLS_COMISSIO.includes(rol as typeof ROLS_COMISSIO[number])
}
