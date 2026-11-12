import { useEffect, useState } from 'react'

/** Carrega dados assíncronos com estados de loading/erro. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>({ data: null, loading: true, error: null })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error: Error) => alive && setState({ data: null, loading: false, error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
