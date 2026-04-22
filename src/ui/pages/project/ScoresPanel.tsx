import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, Score } from '../../../types'
import { useAppState } from '../../../state/AppState'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Card } from '../../primitives/Card'
import { Modal } from '../../primitives/Modal'

export function ScoresPanel({ project }: { project: Project }) {
  const { currentUser, getUser, addToast, deleteScore } = useAppState()
  const navigate = useNavigate()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<null | Score>(null)

  const canDelete = useMemo(() => {
    if (currentUser.role === 'admin') return true
    const me = project.members.find((m) => m.userId === currentUser.id)
    return !!me?.roles.includes('owner')
  }, [currentUser, project.members])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scores / Parts</div>
          <div className="mt-1 text-sm text-slate-600">
            MuseScore is the primary format. PDF support is shown as deferred.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            Upload score (simulated)
          </Button>
        </div>
      </div>

      {project.scores.length === 0 ? (
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">No scores yet</div>
          <div className="mt-1 text-sm text-slate-600">
            Use “Upload score” to simulate adding a MuseScore part.
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {project.scores.map((s) => {
            const editor = getUser(s.lastEditorUserId)?.name ?? s.lastEditorUserId
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{s.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone="info">Instrument: {s.instrument}</Badge>
                      <Badge>Type: {s.fileType}</Badge>
                      <Badge>Version: {s.currentVersion}</Badge>
                    </div>
                  </div>
                  <Badge>Updated: {s.lastUpdatedAt}</Badge>
                </div>

                <div className="mt-2 text-xs text-slate-500">Last editor: {editor}</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}/scores/${s.id}/editor`)}
                  >
                    Edit score
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addToast({ title: 'Opened score (simulated)', message: s.name })}
                  >
                    Open score
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/projects/${project.id}?tab=versions`)}
                  >
                    View version history
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!canDelete}
                    onClick={() => setConfirmDelete(s)}
                  >
                    Delete
                  </Button>
                </div>
                {!canDelete && (
                  <div className="mt-1 text-xs text-slate-500">Delete: owner/admin only</div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        title="Upload score (simulated)"
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                addToast({ title: 'Upload complete (simulated)', message: 'MuseScore file placeholder added' })
                setUploadOpen(false)
              }}
            >
              Upload
            </Button>
          </div>
        }
      >
        <div className="text-sm text-slate-600">
          File upload is out of scope. This modal shows where MuseScore import would happen.
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-900">Supported (prototype UI)</div>
          <ul className="mt-1 list-disc pl-5 text-slate-600">
            <li>MuseScore (.mscz) — primary</li>
            <li>PDF — temporarily deferred</li>
          </ul>
        </div>
      </Modal>

      <Modal
        title="Delete score (simulated)"
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmDelete) return
                deleteScore(project.id, confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Confirm delete
            </Button>
          </div>
        }
      >
        <div className="text-sm text-slate-600">
          This deletion is simulated and only updates local mock state.
        </div>
        <div className="mt-2 text-sm font-medium text-slate-900">{confirmDelete?.name}</div>
      </Modal>
    </div>
  )
}

