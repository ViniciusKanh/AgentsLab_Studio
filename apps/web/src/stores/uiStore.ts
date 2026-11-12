import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'info' | 'warn' | 'error'
}

interface UiState {
  toasts: Toast[]
  toast: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
  notificationsOpen: boolean
  setNotificationsOpen: (v: boolean) => void
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
}

let seq = 1
export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  toast(message, tone = 'info') {
    const id = seq++
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) })
    setTimeout(() => get().dismiss(id), 3800)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
  notificationsOpen: false,
  setNotificationsOpen: (v) => set({ notificationsOpen: v }),
  helpOpen: false,
  setHelpOpen: (v) => set({ helpOpen: v }),
}))
