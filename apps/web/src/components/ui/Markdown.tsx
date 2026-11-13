import { Fragment, type ReactNode } from 'react'

/**
 * Renderizador Markdown mínimo e seguro (sem HTML bruto, sem dependências):
 * títulos, listas, tabelas, negrito, itálico, código e links http(s).
 * Usado para documentos produzidos pelos agentes.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|https?:\/\/[^\s)<>\]]+|\[E\d+\])/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const k = `${key}-${i++}`
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k} className="rounded bg-white/10 px-1">{t.slice(1, -1)}</code>)
    else if (t.startsWith('http')) out.push(<a key={k} href={t} target="_blank" rel="noreferrer noopener" className="break-all text-neon-cyan underline">{t}</a>)
    else if (t.startsWith('[E')) out.push(<span key={k} className="rounded bg-neon-cyan/15 px-0.5 font-bold text-neon-cyan">{t}</span>)
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** size="lg": leitura de documentos (texto maior); padrão compacto para painéis. */
export function Markdown({ source, className, size = 'sm' }: { source: string; className?: string; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg'
  const lines = source.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lines.length) {
    const line = lines[i]
    const k = `b${n++}`
    if (!line.trim()) { i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const hs = (lg ? ['text-[22px]', 'text-[18px]', 'text-[16px]', 'text-[15px]'] : ['text-[17px]', 'text-[15px]', 'text-[13.5px]', 'text-[12.5px]'])[h[1].length - 1]
      blocks.push(<p key={k} className={`${hs} ${lg ? 'mb-2 mt-5' : 'mb-1.5 mt-3'} font-extrabold text-lab-text`}>{inline(h[2], k)}</p>)
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      blocks.push(
        <div key={k} className="my-2 overflow-x-auto">
          <table className={`w-full border-collapse ${lg ? 'text-[13px]' : 'text-[11.5px]'}`}>
            <tbody>{rows.map((r, ri) => <tr key={ri} className={ri === 0 ? 'bg-white/5 font-bold' : 'border-t border-white/10'}>{r.map((c, ci) => <td key={ci} className="px-2 py-1 align-top">{inline(c, `${k}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+\./.test(line)
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++ }
      const L = ordered ? 'ol' : 'ul'
      blocks.push(<L key={k} className={`${ordered ? 'list-decimal' : 'list-disc'} my-1 space-y-0.5 pl-5`}>{items.map((it, ii) => <li key={ii}>{inline(it, `${k}-${ii}`)}</li>)}</L>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) { para.push(lines[i]); i++ }
    blocks.push(<p key={k} className="my-1.5">{para.map((p, pi) => <Fragment key={pi}>{pi > 0 && <br />}{inline(p, `${k}-${pi}`)}</Fragment>)}</p>)
  }
  return <div className={`min-w-0 break-words ${lg ? 'text-[14.5px] leading-[1.7]' : 'text-[12px] leading-relaxed'} ${className ?? ''}`}>{blocks}</div>
}
