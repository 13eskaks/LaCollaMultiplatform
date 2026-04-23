import { PREMIUM_TRAMOS } from './constants'
import type { BalancPersonal, DespesaParticipant, Despesa } from './types'

// =====================
// PREMIUM TRAMOS
// =====================

export function getTramoPerMembres(numMembres: number) {
  return PREMIUM_TRAMOS.find(
    t => numMembres >= t.membres_min &&
    (t.membres_max === null || numMembres <= t.membres_max)
  ) ?? null
}

export function getPricePerPersonMonth(tramo: typeof PREMIUM_TRAMOS[number], numMembres: number) {
  return (tramo.preu_mensual / numMembres).toFixed(2)
}

// =====================
// CAIXA COMPARTIDA
// =====================

export function calcularBalancos(
  despeses: Despesa[],
  participants: DespesaParticipant[]
): BalancPersonal[] {
  const balancos: Record<string, BalancPersonal> = {}

  for (const despesa of despeses) {
    const pagadorId = despesa.pagat_per
    if (!pagadorId) continue

    if (!balancos[pagadorId]) {
      balancos[pagadorId] = { user_id: pagadorId, total_pagat: 0, total_deu: 0, balanc: 0 }
    }
    balancos[pagadorId].total_pagat += despesa.import
  }

  for (const participant of participants) {
    if (!balancos[participant.user_id]) {
      balancos[participant.user_id] = { user_id: participant.user_id, total_pagat: 0, total_deu: 0, balanc: 0 }
    }
    balancos[participant.user_id].total_deu += participant.import_proporcional
  }

  for (const balanc of Object.values(balancos)) {
    balanc.balanc = balanc.total_pagat - balanc.total_deu
  }

  return Object.values(balancos)
}

// =====================
// DATES
// =====================

export function formatData(dateStr: string, locale: string = 'ca-ES'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

export function formatHora(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ca-ES', {
    hour: '2-digit', minute: '2-digit'
  })
}

export function setmanaDeData(date: Date): { inici: Date; fi: Date } {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const inici = new Date(date.setDate(diff))
  const fi = new Date(inici)
  fi.setDate(fi.getDate() + 6)
  return { inici, fi }
}

// =====================
// STRINGS
// =====================

export function getInitials(nom: string, cognoms?: string | null): string {
  const first = nom.charAt(0).toUpperCase()
  const last = cognoms ? cognoms.charAt(0).toUpperCase() : ''
  return `${first}${last}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
