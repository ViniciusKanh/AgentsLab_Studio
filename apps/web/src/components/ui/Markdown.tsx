import { Fragment, type ReactNode } from 'react'

/**
 * Renderizador Markdown seguro (sem HTML bruto, sem dependências) para os documentos dos agentes:
 * títulos com âncoras (sumário navegável), listas (inclusive aninhadas), tabelas com alinhamento,
 * citações (>), blocos de código, linha horizontal, negrito/itálico, links e marcações de evidência [E#]
 * e pendências ([FONTE NECESSÁRIA]). Gera tags semânticas (h1–h4, table, blockquote) — usadas também na exportação em PDF.
 */
export function slug(text: string) {
  return 'sec-' + text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export interface Heading { level: number; text: string; id: string }

/** Títulos do documento (## e ###) para o sumário lateral. */
export function extractHeadings(source: string): Heading[] {
  let fence = false
  const out: Heading[] = []
  for (const line of source.replace(/\r/g, '').split('\n')) {
    if (line.trim().startsWith('```')) fence = !fence
    const h = !fence && /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) out.push({ level: h[1].length, text: plain(h[2]), id: slug(plain(h[2])) })
  }
  return out
}

const plain = (t: string) => t.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').trim()

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)<>\]]+|\[E\d+(?:\s*[,;]\s*E\d+)*\]|\[(?:FONTE NECESSÁRIA|RESULTADO NÃO FORNECIDO|[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{6,}[^\]]*)\])/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const k = `${key}-${i++}`
    if (t.startsWith('**')) out.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k} className="md-code">{t.slice(1, -1)}</code>)
    else if (/^\[[^\]]+\]\(/.test(t)) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer noopener" className="md-link">{label}</a>)
    } else if (t.startsWith('http')) out.push(<a key={k} href={t} target="_blank" rel="noreferrer noopener" className="md-link break-all">{t}</a>)
    else if (/^\[E\d+(?:\s*[,;]\s*E\d+)*\]$/.test(t)) out.push(<span key={k} className="md-cite">{t}</span>)
    else if (t.startsWith('[')) out.push(<mark key={k} className="md-pending">{t}</mark>)
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

/** Lista com aninhamento por indentação. */
function list(lines: string[], start: number, key: string): [ReactNode, number] {
  const base = LIST.exec(lines[start])![1].length
  const ordered = /\d/.test(LIST.exec(lines[start])![2])
  const items: ReactNode[] = []
  let i = start
  while (i < lines.length) {
    const m = LIST.exec(lines[i])
    if (!m || m[1].length < base) break
    if (m[1].length > base) {
      const [sub, next] = list(lines, i, `${key}-${i}`)
      items.push(<li key={`s${i}`} className="list-none">{sub}</li>)
      i = next
      continue
    }
    items.push(<li key={i}>{inline(m[3], `${key}-${i}`)}</li>)
    i++
  }
  const L = ordered ? 'ol' : 'ul'
  return [<L key={key} className={ordered ? 'md-ol' : 'md-ul'}>{items}</L>, i]
}

/** size="lg": leitura de documentos; variant="paper": página de documento (tela de entrega). */
export function Markdown({ source, className, size = 'sm', variant = 'panel' }: { source: string; className?: string; size?: 'sm' | 'lg'; variant?: 'panel' | 'paper' }) {
  const lines = source.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0
  // metadados YAML (cabeçalho do .md baixado) não são exibidos como texto
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1)
    if (end > 0) i = end + 1
  }
  while (i < lines.length) {
    const line = lines[i]
    const k = `b${n++}`
    if (!line.trim()) { i++; continue }
    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(<pre key={k} className="md-pre"><code>{code.join('\n')}</code></pre>)
      continue
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={k} className="md-hr" />); i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length as 1 | 2 | 3 | 4
      const H = `h${level}` as 'h1'
      blocks.push(<H key={k} id={slug(plain(h[2]))} className={`md-h${level}`}>{inline(h[2], k)}</H>)
      i++
      continue
    }
    if (line.trim().startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/, ''))
      blocks.push(<blockquote key={k} className="md-quote">{quote.map((q, qi) => <p key={qi}>{inline(q, `${k}-${qi}`)}</p>)}</blockquote>)
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      let align: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) align = cells.map((c) => (c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : 'left'))
        else rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={k} className="md-table-wrap">
          <table className="md-table">
            {head && <thead><tr>{head.map((c, ci) => <th key={ci} style={{ textAlign: (align[ci] ?? 'left') as 'left' }}>{inline(c, `${k}-h-${ci}`)}</th>)}</tr></thead>}
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ textAlign: (align[ci] ?? 'left') as 'left' }}>{inline(c, `${k}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (LIST.test(line)) {
      const [node, next] = list(lines, i, k)
      blocks.push(node)
      i = next
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*>|\s*```|\s*(-{3,}|\*{3,})\s*$)/.test(lines[i]) && !LIST.test(lines[i])) { para.push(lines[i]); i++ }
    blocks.push(<p key={k} className="md-p">{para.map((p, pi) => <Fragment key={pi}>{pi > 0 && (para[pi - 1].endsWith('  ') ? <br /> : ' ')}{inline(p.trimEnd(), `${k}-${pi}`)}</Fragment>)}</p>)
  }
  return <div className={`md md-${size} md-${variant} min-w-0 break-words ${className ?? ''}`}>{blocks}</div>
}
