import { Outlet } from 'react-router-dom'
import { RightSidebar } from './RightSidebar'

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-rose-50/30 dark:bg-slate-950">
      {/* Main Content Area */}
      <main className="flex-1 pb-16 md:pb-0 md:pr-20">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
          <Outlet />
        </div>
      </main>

      {/* Navigation */}
      <div className="group fixed inset-y-0 right-0 z-50">
        <RightSidebar />
      </div>
    </div>
  )
}
