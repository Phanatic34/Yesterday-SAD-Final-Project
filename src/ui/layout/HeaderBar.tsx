import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import { Avatar } from '../primitives/Avatar'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'

export function HeaderBar() {
  const { currentUser, switchUser } = useAppState()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">
            Yesterday
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 sm:flex">
            <div className="text-xs font-medium text-slate-600">Prototype mode</div>
            <select
              value={currentUser.role}
              onChange={(e) => {
                switchUser(e.target.value as any)
                navigate('/')
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
              aria-label="Prototype mode (demo scenario)"
              title="Demo-only control: changes visible permissions for the prototype"
            >
              <option value="regular">Member</option>
              <option value="owner">Project Owner</option>
              <option value="admin">Admin</option>
            </select>
            <Badge className="hidden md:inline-flex" tone="warn">
              demo
            </Badge>
          </div>

          <Button variant="ghost" onClick={() => navigate('/projects')}>
            Projects
          </Button>

          <div className="flex items-center gap-2">
            <Avatar name={currentUser.name} src={currentUser.avatarUrl} size={32} />
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-slate-900">{currentUser.name}</div>
              <div className="text-xs text-slate-500">Logged in</div>
            </div>
          </div>

          <Button onClick={() => navigate(`/users/${currentUser.id}`)}>Profile</Button>
        </div>
      </div>
    </header>
  )
}

