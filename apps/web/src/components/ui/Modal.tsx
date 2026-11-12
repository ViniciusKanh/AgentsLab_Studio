import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx, type Accent } from './primitives'

export function Modal({ open, onClose, title, children, accent = 'purple', width = 520, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; accent?: Accent; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#02050c]/80 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx('px-panel w-full', `c-${accent}`)} style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <h2 className="title-pixel text-[11px] text-lab-text">{title}</h2>
          <button className="ml-auto text-lab-muted hover:text-white" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-white/5 px-4 py-2.5">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar' }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode; confirmLabel?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title} accent="pink" width={420}
      footer={<>
        <button className="px-btn ghost c-cyan" onClick={onClose}>Cancelar</button>
        <button className="px-btn solid" style={{ ['--c' as string]: '#ff537a' }} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
      </>}>
      <p className="text-[12px] leading-relaxed text-lab-text/90">{message}</p>
    </Modal>
  )
}
