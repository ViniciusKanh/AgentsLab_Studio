import { describe, expect, it } from 'vitest'
import { emptyDraft, validateStep } from '@/features/agents/agentForm'
import type { ProviderId } from '@/types/domain'

const models = { gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'], groq: [], openai: [], huggingface: [], ollama: [] } as Record<ProviderId, string[]>

describe('validação do Agent Studio', () => {
  it('exige nome e objetivo na identidade', () => {
    const e = validateStep('identidade', emptyDraft(), models)
    expect(e.name).toBeDefined()
    expect(e.objective).toBeDefined()
  })

  it('aceita um rascunho completo', () => {
    const d = { ...emptyDraft({ name: 'Pesquisador IA', objective: 'Buscar e resumir artigos científicos' }) }
    expect(validateStep('revisao', d, models)).toEqual({})
  })

  it('impede limites que gerariam consumo descontrolado', () => {
    const d = emptyDraft({ name: 'Agente', objective: 'Objetivo suficientemente longo' })
    d.limits.maxRetries = 9
    d.limits.maxTokensPerRun = 100
    const e = validateStep('configuracao', d, models)
    expect(e.maxRetries).toBeDefined()
    expect(e.maxTokensPerRun).toBeDefined()
  })

  it('exige base quando RAG está ativo', () => {
    const d = emptyDraft({ name: 'Agente RAG', objective: 'Responder com base nos documentos' })
    d.knowledge.ragEnabled = true
    expect(validateStep('conhecimento', d, models).ragBaseId).toBeDefined()
  })
})
