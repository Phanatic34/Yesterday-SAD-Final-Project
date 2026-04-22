import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../../state/AppState'
import { Button } from '../../primitives/Button'
import { Modal } from '../../primitives/Modal'

const defaultInstruments = ['violin', 'viola', 'cello', 'flute', 'clarinet', 'trumpet', 'piano']

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProject } = useAppState()
  const navigate = useNavigate()

  const [name, setName] = useState('New Ensemble Project')
  const [description, setDescription] = useState('Prototype project created locally (no backend).')
  const [ensembleType, setEnsembleType] = useState('orchestra')
  const [instruments, setInstruments] = useState<string[]>(defaultInstruments.slice(0, 4))
  const [inviteMembers, setInviteMembers] = useState('mia@example.com, ava@example.com')

  const inviteEmails = useMemo(
    () =>
      inviteMembers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [inviteMembers],
  )

  return (
    <Modal
      title="Create project (simulated)"
      open={open}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const p = createProject({
                name,
                description,
                ensembleType,
                initialInstruments: instruments,
                inviteEmails,
              })
              onClose()
              navigate(`/projects/${p.id}`)
            }}
          >
            Create
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="text-sm font-medium text-slate-800">Project name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div>
          <div className="text-sm font-medium text-slate-800">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-slate-800">Ensemble type</div>
            <select
              value={ensembleType}
              onChange={(e) => setEnsembleType(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="orchestra">orchestra</option>
              <option value="band">band</option>
              <option value="chamber group">chamber group</option>
            </select>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">Initial instruments</div>
            <select
              multiple
              value={instruments}
              onChange={(e) =>
                setInstruments(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="mt-1 h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {defaultInstruments.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-slate-500">Hold ⌘/Ctrl to multi-select.</div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-slate-800">Invite members (emails)</div>
          <input
            value={inviteMembers}
            onChange={(e) => setInviteMembers(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
          <div className="mt-1 text-xs text-slate-500">
            Simulation only. Invitations show as a toast; no real emails are sent.
          </div>
        </div>
      </div>
    </Modal>
  )
}

