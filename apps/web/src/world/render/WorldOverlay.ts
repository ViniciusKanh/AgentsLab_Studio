/**
 * Camada DOM sobre o canvas: rótulos e balões de fala nítidos (texto real),
 * posicionados a cada quadro SEM passar pelo React (evita re-renderizações).
 */
export interface OverlayActor {
  id: string
  sx: number
  sy: number
  zoom: number
  name: string
  role: string
  color: string
  selected: boolean
  visible: boolean
}

const KIND_STYLE: Record<string, string> = {
  ambiente: 'border-color:#e6ecff;background:#f6f8ff;color:#141f39',
  'operacional-demo': 'border-color:#ffb800;background:#fff8e6;color:#3a2a00',
  'operacional-real': 'border-color:#00f5a0;background:#e9fff6;color:#04120c',
}

export class WorldOverlay {
  readonly root: HTMLDivElement
  private tags = new Map<string, HTMLDivElement>()
  private bubbles = new Map<string, { el: HTMLDivElement; until: number }>()
  private labels = true

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'pointer-events-none absolute inset-0 z-0 overflow-hidden'
    this.root.setAttribute('data-testid', 'world-overlay')
    parent.appendChild(this.root)
  }

  setLabels(v: boolean) {
    this.labels = v
  }

  say(id: string, text: string, kind: string, ttl = 3200) {
    let b = this.bubbles.get(id)
    if (!b) {
      const el = document.createElement('div')
      el.className = 'world-bubble'
      this.root.appendChild(el)
      b = { el, until: 0 }
      this.bubbles.set(id, b)
    }
    b.el.textContent = text
    b.el.setAttribute('style', `${KIND_STYLE[kind] ?? KIND_STYLE.ambiente};opacity:0`)
    b.el.dataset.kind = kind
    b.until = performance.now() + ttl
  }

  sync(actors: OverlayActor[]) {
    const now = performance.now()
    const seen = new Set<string>()
    for (const a of actors) {
      seen.add(a.id)
      let tag = this.tags.get(a.id)
      if (!tag) {
        tag = document.createElement('div')
        tag.className = 'world-tag'
        tag.setAttribute('data-testid', `tag-${a.id}`)
        this.root.appendChild(tag)
        this.tags.set(a.id, tag)
      }
      const txt = a.selected ? `${a.name}` : a.role
      if (tag.textContent !== txt) tag.textContent = txt
      const showTag = a.visible && (this.labels || a.selected)
      tag.style.display = showTag ? 'block' : 'none'
      if (showTag) {
        tag.style.transform = `translate(${Math.round(a.sx)}px, ${Math.round(a.sy - 38 * a.zoom)}px) translate(-50%, -100%)`
        tag.style.borderColor = a.color
        tag.classList.toggle('is-selected', a.selected)
      }
      const b = this.bubbles.get(a.id)
      if (b) {
        const alive = b.until > now && a.visible
        b.el.style.opacity = alive ? '1' : '0'
        if (alive) b.el.style.transform = `translate(${Math.round(a.sx)}px, ${Math.round(a.sy - 38 * a.zoom - (showTag ? 18 : 2))}px) translate(-50%, -100%)`
      }
    }
    for (const [id, el] of this.tags) if (!seen.has(id)) { el.remove(); this.tags.delete(id) }
    for (const [id, b] of this.bubbles) if (!seen.has(id)) { b.el.remove(); this.bubbles.delete(id) }
  }

  destroy() {
    this.root.remove()
    this.tags.clear()
    this.bubbles.clear()
  }
}
