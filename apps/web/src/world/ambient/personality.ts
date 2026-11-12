import type { Personality } from '../types'

export const DEFAULT_PERSONALITY: Personality = {
  sociability: 50, creativity: 50, organization: 50, curiosity: 50, collaboration: 50, initiative: 50, preference: 'duplas',
}

/** Perfil inicial coerente com o departamento (editável no Agent Studio). */
export function personalityFor(department: string, robot = false): Personality {
  const base = { ...DEFAULT_PERSONALITY }
  const presets: Record<string, Partial<Personality>> = {
    Pesquisa: { curiosity: 85, creativity: 65, sociability: 45, organization: 55 },
    'Dados & BI': { organization: 80, initiative: 70, sociability: 40 },
    Conhecimento: { curiosity: 70, organization: 70, sociability: 35, preference: 'individual' },
    Operações: { initiative: 85, organization: 75, sociability: 30 },
    Conteúdo: { creativity: 85, sociability: 70, preference: 'grupos' },
    Desenvolvimento: { organization: 65, initiative: 75, sociability: 40, preference: 'individual' },
    Qualidade: { organization: 90, collaboration: 70, sociability: 50 },
    Gestão: { sociability: 80, collaboration: 85, preference: 'grupos' },
    Orquestração: { collaboration: 90, sociability: 75, initiative: 80, preference: 'grupos' },
  }
  const p = { ...base, ...(presets[department] ?? {}) }
  if (robot) Object.assign(p, { initiative: 90, curiosity: 60, sociability: 45 })
  return p
}

export const PERSONALITY_LABELS: Record<Exclude<keyof Personality, 'preference'>, string> = {
  sociability: 'Sociabilidade', creativity: 'Criatividade', organization: 'Organização', curiosity: 'Curiosidade', collaboration: 'Colaboração', initiative: 'Iniciativa',
}
