import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import { Card } from '../primitives/Card'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'
import { CreateProjectModal } from './modals/CreateProjectModal'

export function HomePage() {
  const { currentUser, projects } = useAppState()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

  const preview = useMemo(() => projects.slice(0, 3), [projects])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            Yesterday
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/projects')}>View projects</Button>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            Create project
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/users/${currentUser.id}`)}>
            Go to profile
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            disabled={currentUser.role !== 'admin'}
          >
            Admin dashboard
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Project preview</div>
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            Open full list
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {preview.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="text-sm font-semibold text-slate-900">{p.name}</div>
              <div className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>Ensemble: {p.ensembleType}</Badge>
                <Badge>Members: {p.members.length}</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => navigate(`/projects/${p.id}`)}>
                  Open
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/projects')}>
                  More
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

