import { useEffect, useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from './router'
import { bootstrap } from './bootstrap'

export default function App() {
  const router = useMemo(() => createAppRouter(), [])
  useEffect(() => {
    void bootstrap()
  }, [])
  return <RouterProvider router={router} />
}
