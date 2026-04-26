import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import { Button } from '../primitives/Button'
import { Card } from '../primitives/Card'

const SCORE_PDF_MAP: Record<string, { title: string; pdfUrl: string }> = {
  's-canon-v1': {
    title: 'Symphony No.9, Op.95 — Violin II Part',
    pdfUrl: '/pdf/dvorak-sym9-violin2.pdf',
  },
  's-canon-v2': {
    title: 'Symphony No.9, Op.95 — Violin I Part',
    pdfUrl: '/pdf/dvorak-sym9-violin1.pdf',
  },
  's-canon-full': {
    title: 'Symphony No.9, Op.95 — Full Score',
    pdfUrl: '/pdf/dvorak-sym9-full-score.pdf',
  },
}

export function ScorePdfViewPage() {
  const navigate = useNavigate()
  const { projectId, songId } = useParams()
  const [searchParams] = useSearchParams()
  const { getProject } = useAppState()

  const project = projectId ? getProject(projectId) : undefined
  const song = useMemo(
    () => project?.songs?.find((s) => s.id === songId),
    [project, songId],
  )
  const scoreId = searchParams.get('scoreId') ?? 's-canon-v1'
  const pdfEntry = SCORE_PDF_MAP[scoreId] ?? SCORE_PDF_MAP['s-canon-v1']
  const pdfUrl = pdfEntry.pdfUrl

  if (!project || !song) {
    return (
      <Card className="p-6">
        <div className="text-sm font-semibold text-slate-900">Score PDF not found</div>
        <div className="mt-1 text-sm text-slate-600">
          Go back to the project and open the score again.
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/projects')}>
            Back to projects
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xl font-semibold text-slate-900">{pdfEntry.title}</div>
          <div className="mt-1 text-sm text-slate-600">Composer: Dvořák, Antonín</div>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}?tab=scores`)}>
          Back to scores
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Presentation mode PDF preview
        </div>
        <iframe
          title={pdfEntry.title}
          src={pdfUrl}
          className="h-[78vh] w-full bg-white"
        />
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm text-slate-600">
            If the PDF cannot be previewed in this browser, open it in a new tab.
          </div>
          <div className="mt-2">
            <Button onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}>
              Open in new tab
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
