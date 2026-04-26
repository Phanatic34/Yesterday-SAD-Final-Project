import { NavLink } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import { cn } from '../utils/cn'
import { Shield, User, FolderKanban, Home, LogIn } from 'lucide-react'

export function Sidebar() {
  const { currentUser } = useAppState()

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-full flex-col p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <img
              src="https://stickershop.line-scdn.net/stickershop/v1/product/16789893/LINEStorePC/main.png?v=1"
              alt="Yesterday logo"
              className="size-9 rounded-lg border border-slate-200 bg-white object-contain"
              loading="lazy"
            />
            <div>
              <div className="text-sm font-semibold">Yesterday</div>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <SideLink to="/" icon={<Home className="size-4" />} label="Home" />
          <SideLink
            to="/projects"
            icon={<FolderKanban className="size-4" />}
            label="Projects"
          />
          <SideLink to="/login" icon={<LogIn className="size-4" />} label="Login" />
          <SideLink
            to={`/users/${currentUser.id}`}
            icon={<User className="size-4" />}
            label="Profile"
          />
          <SideLink
            to="/admin"
            icon={<Shield className="size-4" />}
            label="Admin"
            disabled={currentUser.role !== 'admin'}
          />
        </nav>

        <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Demo scenario</div>
          <div className="mt-1 text-sm font-medium">{currentUser.name}</div>
          <div className="text-xs text-slate-500">
            Prototype mode:{' '}
            <span className="font-medium text-slate-700">{currentUser.role}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SideLink({
  to,
  label,
  icon,
  disabled,
}: {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400">
        <div className="text-slate-300">{icon}</div>
        {label}
      </div>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-slate-100',
          isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700',
        )
      }
      end={to === '/'}
    >
      {icon}
      {label}
    </NavLink>
  )
}

