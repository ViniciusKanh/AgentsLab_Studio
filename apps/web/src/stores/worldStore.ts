import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FeedItem } from '@/world/events/bus'
import type { WorldProp } from '@/world/types'

/**
 * Estado de INTERFACE do mundo virtual (não confundir com o estado operacional
 * dos agentes, que fica em simulationStore). Velocidade afeta somente a camada ambiental.
 */
interface WorldUiState {
  ambientSpeed: 0 | 1 | 3
  lastEnv: string
  setLastEnv: (v: string) => void
  labels: boolean
  observer: boolean
  management: boolean
  sidebarCollapsed: boolean
  /** menu lateral aberto no celular (não persistido) */
  mobileNav: boolean
  setMobileNav: (v: boolean) => void
  feedOpen: boolean
  feed: FeedItem[]
  selectedProp: { prop: WorldProp; envId: string } | null
  setAmbientSpeed: (v: 0 | 1 | 3) => void
  setLabels: (v: boolean) => void
  setObserver: (v: boolean) => void
  setManagement: (v: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  setFeedOpen: (v: boolean) => void
  pushFeed: (item: FeedItem) => void
  selectProp: (p: { prop: WorldProp; envId: string } | null) => void
}

export const useWorldStore = create<WorldUiState>()(
  persist(
    (set, get) => ({
      ambientSpeed: 1,
      lastEnv: 'office',
      setLastEnv: (v) => set({ lastEnv: v }),
      labels: true,
      observer: false,
      management: false,
      sidebarCollapsed: false,
      mobileNav: false,
      setMobileNav: (v) => set({ mobileNav: v }),
      feedOpen: true,
      feed: [],
      selectedProp: null,
      setAmbientSpeed: (v) => set({ ambientSpeed: v }),
      setLabels: (v) => set({ labels: v }),
      setObserver: (v) => set({ observer: v }),
      setManagement: (v) => set({ management: v }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setFeedOpen: (v) => set({ feedOpen: v }),
      pushFeed: (item) => {
        const feed = get().feed
        // evita repetir a mesma frase em sequência
        if (feed[0] && feed[0].text === item.text) return
        set({ feed: [item, ...feed].slice(0, 80) })
      },
      selectProp: (p) => set({ selectedProp: p }),
    }),
    {
      name: 'agentslab:ui:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lastEnv: s.lastEnv, labels: s.labels, sidebarCollapsed: s.sidebarCollapsed, feedOpen: s.feedOpen, ambientSpeed: s.ambientSpeed }),
    },
  ),
)
