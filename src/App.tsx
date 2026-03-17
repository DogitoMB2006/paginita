import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { CosasQueHacer } from './pages/CosasQueHacer'
import { Perfil } from './pages/Perfil'
import { Planes } from './pages/Planes'
import { Cartitas } from './pages/Cartitas'

function App() {
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rose-50/50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      
      {/* Protected Routes inside Layout */}
      <Route
        path="/dashboard"
        element={session ? <DashboardLayout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Dashboard />} />
        <Route path="todo" element={<CosasQueHacer />} />
        <Route path="planes" element={<Planes />} />
        <Route path="cartitas" element={<Cartitas />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Dashboard />} />
      </Route>

      {/* Redirect root to dashboard -> logic will push unauth to login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
