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
