import { useMemo, useState } from 'react'
import type { Commit, Project } from '../../../types'
import { useAppState } from '../../../state/AppState'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Card } from '../../primitives/Card'
import { Modal } from '../../primitives/Modal'

export function VersionsPanel({ project }: { project: Project }) {
  const { getUser, addToast } = useAppState()
  const [compare, setCompare] = useState<null | Commit>(null)

  const commits = useMemo(() => project.commits, [project.commits])

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">Version history (commits)</div>
        <div className="mt-1 text-sm text-slate-600">
          Git-like commit list (mock). Preview/compare/restore are simulated.
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c) => (
                <tr key={c.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.message}</div>
                    {c.changedScoreId && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        Changed: <span className="font-medium">{c.changedScoreId}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getUser(c.authorUserId)?.name ?? c.authorUserId}
                  </td>
                  <td className="px-4 py-3">{c.timestamp}</td>
                  <td className="px-4 py-3">
                    <Badge tone="info">{c.branch}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addToast({ title: 'Preview opened (simulated)', message: c.message })}
                      >
                        Preview
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setCompare(c)}>
                        Compare
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addToast({ title: 'Restored (simulated)', message: `Reverted to: ${c.message}` })}
                      >
                        Restore
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        title="Compare version (mock side-by-side)"
        open={!!compare}
        onClose={() => setCompare(null)}
        maxWidthClassName="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompare(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="text-sm text-slate-600">
          Version comparison is visual-only in this prototype: we show a “changed markings” panel.
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-500">Current</div>
            <div className="mt-2 space-y-2 text-sm">
              <MockDiffRow label="Measure 12" value="↓ bow + fingering 2" />
              <MockDiffRow label="Measure 14" value="crescendo marking" />
              <MockDiffRow label="Measure 18" value="phrase slur adjusted" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-500">
              Selected commit
              {compare ? <span className="ml-2 text-slate-900">{compare.message}</span> : null}
            </div>
            <div className="mt-2 space-y-2 text-sm">
              <MockDiffRow label="Measure 12" value="↑ bow" />
              <MockDiffRow label="Measure 14" value="(none)" />
              <MockDiffRow label="Measure 18" value="staccato hint" />
            </div>
          </Card>
        </div>
      </Modal>
    </div>
  )
}

function MockDiffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-slate-700">{label}</div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  )
}

