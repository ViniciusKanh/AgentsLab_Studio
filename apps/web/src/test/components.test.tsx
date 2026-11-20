import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DemoTag, Tabs, Toggle } from '@/components/ui/primitives'
import { StatCard } from '@/components/ui/StatCard'

describe('componentes de UI', () => {
  it('DemoTag explica que os dados são fictícios', () => {
    render(<DemoTag />)
    expect(screen.getByText('DEMO')).toHaveAttribute('title', expect.stringMatching(/fictícios/))
  })

  it('Toggle alterna estado', async () => {
    function T() { const [v, setV] = useState(false); return <Toggle checked={v} onChange={setV} label="x" /> }
    render(<T />)
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('Tabs marca a aba selecionada', async () => {
    function T() { const [v, setV] = useState<'a' | 'b'>('a'); return <Tabs value={v} onChange={setV} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} /> }
    render(<T />)
    await userEvent.click(screen.getByRole('tab', { name: 'B' }))
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true')
  })

  it('StatCard formata KPI em pt-BR', () => {
    render(<StatCard kpi={{ key: 'tokens', label: 'Tokens', value: 4_920_000, format: 'compact', delta: 9.3, deltaUnit: '%' }} icon="coin" accent="gold" />)
    expect(screen.getByText('4,92M')).toBeInTheDocument()
    expect(screen.getByText(/\+9,3%/)).toBeInTheDocument()
  })
})

describe('Markdown (leitor de documentos)', () => {
  it('gera títulos com âncora, tabela com cabeçalho, citações e pendências destacadas', async () => {
    const { render } = await import('@testing-library/react')
    const { Markdown, extractHeadings } = await import('@/components/ui/Markdown')
    const src = '---\ndocumento: D1\n---\n# Título\n\n## 1. Introdução\n\nTexto [E1] e [FONTE NECESSÁRIA].\n\n| A | B |\n|---|---:|\n| x | 2 |\n\n- item\n  - sub\n\n> citação'
    const { container } = render(<Markdown source={src} size="lg" variant="paper" />)
    expect(container.querySelector('h2#sec-1-introducao')).not.toBeNull()
    expect(container.querySelector('thead th')?.textContent).toBe('A')
    expect(container.querySelector('.md-cite')?.textContent).toBe('[E1]')
    expect(container.querySelector('.md-pending')?.textContent).toBe('[FONTE NECESSÁRIA]')
    expect(container.querySelector('blockquote')).not.toBeNull()
    expect(container.textContent).not.toContain('documento: D1')
    expect(extractHeadings(src).map((h) => h.level)).toEqual([1, 2])
  })
})
