import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { isElectronRuntime } from './lib/runtime'
import { ElectronTitleBar } from './components/ElectronTitleBar'

import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { CosasQueHacer } from './pages/CosasQueHacer'
import { Perfil } from './pages/Perfil'
import { Planes } from './pages/Planes'
import { Cartitas } from './pages/Cartitas'
import { ParaVer } from './pages/ParaVer'

function App() {
  const location = useLocation()
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const showTitleBar = isElectronRuntime() && location.pathname !== '/login'

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
    <>
      {showTitleBar && <ElectronTitleBar />}
      <div className={showTitleBar ? 'pt-10' : ''}>
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
            <Route path="para-ver" element={<ParaVer />} />
            <Route path="cartitas" element={<Cartitas />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Dashboard />} />
          </Route>

          {/* Redirect root to dashboard -> logic will push unauth to login */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default App
