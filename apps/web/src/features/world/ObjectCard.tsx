import { X } from 'lucide-react'
import { useWorldStore } from '@/stores/worldStore'

const KIND_LABEL: Record<string, string> = { work: 'Estação de trabalho', meet: 'Ponto de reunião', coffee: 'Área de café', rest: 'Descanso', read: 'Leitura', observe: 'Equipamento', decor: 'Decoração' }

/** Cartão do objeto interativo selecionado no cenário. */
export function ObjectCard() {
  const sel = useWorldStore((s) => s.selectedProp)
  const close = () => useWorldStore.getState().selectProp(null)
  if (!sel) return null
  const p = sel.prop
  return (
    <div className="absolute bottom-3 left-1/2 w-[300px] -translate-x-1/2 rounded-[8px] border border-neon-cyan/60 bg-[#070b17]/94 p-3 text-[11.5px]" data-testid="object-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-neon-cyan">{KIND_LABEL[p.kind] ?? p.kind}</p>
          <p className="text-[13px] font-extrabold">{p.label || 'Objeto'}</p>
          {p.desc && <p className="text-lab-muted">{p.desc}</p>}
        </div>
        <button onClick={close} aria-label="Fechar" className="text-lab-muted hover:text-white"><X size={15} /></button>
      </div>
      <p className="mt-1.5 text-[10.5px] text-lab-muted">Os agentes usam este objeto de forma autônoma conforme a personalidade e as tarefas.</p>
    </div>
  )
}
