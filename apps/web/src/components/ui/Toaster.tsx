import { useUiStore } from '@/stores/uiStore'
import { cx } from './primitives'

const TONE: Record<string, string> = { success: '#00f5a0', info: '#39d6ff', warn: '#ffb800', error: '#ff537a' }

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[120] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className={cx('px-panel pointer-events-auto px-3 py-2 text-left text-[12px] font-bold')} style={{ ['--c' as string]: TONE[t.tone] }}>
          <span style={{ color: TONE[t.tone] }}>■</span> {t.message}
        </button>
      ))}
    </div>
  )
}
