const BASE = import.meta.env.BASE_URL

export const asset = (p: string) => `${BASE}assets/${p}`
export const avatarUrl = (characterId: string) => asset(`avatars/${characterId}.png`)
export const iconUrl = (name: string) => asset(`ui/icon-${name}.png`)
export const providerIconUrl = (id: string) => asset(`ui/provider-${id}.png`)

export const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#3b82f6',
  groq: '#ff537a',
  openai: '#00f5a0',
  huggingface: '#ffb800',
  ollama: '#e6ecff',
}
