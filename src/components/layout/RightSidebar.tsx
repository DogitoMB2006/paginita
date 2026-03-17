import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, ListTodo, Calendar, Heart, User, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const navItems = [
  { icon: Home, label: 'Inicio', path: '/dashboard', key: 'home' },
  { icon: ListTodo, label: 'Cosas que hacer', path: '/dashboard/todo', key: 'todo' },
  { icon: Calendar, label: 'Planes', path: '/dashboard/planes', key: 'planes' },
  { icon: Heart, label: 'Cartitas', path: '/dashboard/cartitas', key: 'letters' },
  { icon: User, label: 'Perfil', path: '/dashboard/perfil', key: 'perfil' },
]

type RightSidebarProps = {
  todoBadge?: number
  planesBadge?: number
  lettersBadge?: number
}

export function RightSidebar({ todoBadge = 0, planesBadge = 0, lettersBadge = 0 }: RightSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="group fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t border-rose-100 bg-white/80 backdrop-blur-md transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-950/80 md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-screen md:w-20 md:flex-col md:justify-center md:gap-8 md:border-l md:border-t-0 md:hover:w-60">
      
      {/* Spacer for desktop top */}
      <div className="hidden flex-1 md:flex" />

      <div className="flex w-full justify-around md:flex-col md:gap-6 md:px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const badge =
            item.key === 'todo'
              ? todoBadge
              : item.key === 'planes'
              ? planesBadge
              : item.key === 'letters'
              ? lettersBadge
              : 0
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center justify-center rounded-xl p-3 outline-none transition-all duration-300 hover:bg-rose-50 dark:hover:bg-slate-800 md:justify-start ${
                isActive
                  ? 'bg-rose-50 text-primary dark:bg-slate-800 md:scale-100 scale-110'
                  : 'text-slate-500 hover:text-primary dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-center h-6 w-6 shrink-0 transition-transform duration-300 group-hover/link:scale-110">
                <item.icon className={`h-6 w-6 ${isActive ? 'fill-primary/20' : ''}`} />
              </div>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm md:right-0.5">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              
              {/* Desktop Expandable Text */}
              <span className="absolute left-14 ml-2 hidden whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:block">
                {item.label}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary md:-left-1 md:bottom-1/2 md:h-8 md:w-1 md:-translate-y-1/2 md:translate-x-0" />
              )}
            </Link>
          )
        })}
      </div>

      {/* Spacer for desktop bottom */}
      <div className="hidden flex-1 items-end pb-8 md:flex w-full px-4">
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/login', { replace: true })
          }}
          className="relative flex w-full items-center justify-center rounded-xl p-3 text-slate-500 outline-none transition-all duration-300 hover:bg-red-50 hover:text-red-500 dark:text-slate-400 dark:hover:bg-red-950/30 md:justify-start"
        >
          <div className="flex items-center justify-center h-6 w-6 shrink-0 transition-transform duration-300 group-hover/link:-translate-x-1">
             <LogOut className="h-6 w-6" />
          </div>
          <span className="absolute left-14 ml-2 hidden whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:block">
            Cerrar sesión
          </span>
        </button>
      </div>
    </nav>
  )
}
