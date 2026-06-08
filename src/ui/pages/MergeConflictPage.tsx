import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { ApiMergeConflict, ApiMergePreview, MergeConflictResolution } from '../../api/types'
import { useAppState } from '../../state/AppState'
import { useTranslation } from '../../i18n'
import { Badge } from '../primitives/Badge'
import { Button } from '../primitives/Button'
import { Card } from '../primitives/Card'
import { AlertTriangle, ArrowLeft, GitMerge, ShieldCheck } from 'lucide-react'

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; preview: ApiMergePreview }

export function MergeConflictPage() {
  const { projectId } = useParams()
  const [sp] = useSearchParams()
  const fromBranchId = sp.get('from') ?? ''
  const intoBranchId = sp.get('into') ?? ''
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { getProject, loadProjectDetail, previewMerge, mergeBranch, addToast } = useAppState()

  const project = projectId ? getProject(projectId) : undefined
  const paramsValid = Boolean(projectId && fromBranchId && intoBranchId)
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const [resolutions, setResolutions] = useState<Record<string, MergeConflictResolution>>({})
  const [merging, setMerging] = useState(false)

  const backToBranches = () => navigate(`/projects/${projectId}?tab=branches`)

  useEffect(() => {
    if (!paramsValid || !projectId) return
    let cancelled = false
    // `state` already initialises to 'loading'; the async chain below resolves
    // it to 'ready' or 'error'. We avoid a synchronous setState here so the
    // effect doesn't trigger a cascading re-render.
    // Make sure score titles / branch names are available for display.
    loadProjectDetail(projectId)
      .then(() => previewMerge(projectId, fromBranchId, intoBranchId))
      .then((preview) => {
        if (cancelled) return
        setState({ status: 'ready', preview })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : t('merge.loadFailed'),
        })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fromBranchId, intoBranchId, paramsValid])

  const scoreTitle = (scoreId: string) =>
    project?.scores.find((s) => s.id === scoreId)?.title ?? scoreId.slice(0, 8)

  async function runMerge() {
    if (!projectId) return
    setMerging(true)
    try {
      const resolutionList =
        state.status === 'ready' && state.preview.has_conflicts
          ? state.preview.conflicts.map((c) => ({
              scoreId: c.score_id,
              resolution: resolutions[c.score_id],
            }))
          : undefined
      await mergeBranch(projectId, fromBranchId, intoBranchId, resolutionList)
      addToast({ title: t('merge.success') })
      backToBranches()
    } catch (err) {
      addToast({
        title: t('branches.mergeBranch'),
        message: err instanceof ApiError ? err.message : t('projects.tryAgainLater'),
      })
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xl font-semibold text-slate-950">
            <GitMerge className="size-5 text-slate-500" />
            {t('merge.title')}
          </div>
          {state.status === 'ready' && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{t('merge.merging')}</span>
              <Badge tone="info">{state.preview.from_branch.name}</Badge>
              <span>→</span>
              <Badge tone="info">{state.preview.into_branch.name}</Badge>
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={backToBranches}>
          <ArrowLeft className="size-4" />
          {t('merge.backToBranches')}
        </Button>
      </div>

      {!paramsValid && (
        <Card className="p-6">
          <div className="text-sm font-semibold text-rose-700">{t('merge.loadFailed')}</div>
          <div className="mt-1 text-sm text-slate-600">{t('merge.missingParams')}</div>
          <div className="mt-3">
            <Button variant="secondary" onClick={backToBranches}>
              {t('merge.backToBranches')}
            </Button>
          </div>
        </Card>
      )}

      {paramsValid && state.status === 'loading' && (
        <Card className="p-6">
          <div className="text-sm text-slate-600">{t('merge.loading')}</div>
        </Card>
      )}

      {state.status === 'error' && (
        <Card className="p-6">
          <div className="text-sm font-semibold text-rose-700">{t('merge.loadFailed')}</div>
          <div className="mt-1 text-sm text-slate-600">{state.message}</div>
          <div className="mt-3">
            <Button variant="secondary" onClick={backToBranches}>
              {t('merge.backToBranches')}
            </Button>
          </div>
        </Card>
      )}

      {state.status === 'ready' && !state.preview.has_conflicts && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="size-4" />
            {t('merge.noConflicts')}
          </div>
          <div className="mt-1 text-sm text-slate-600">{t('merge.noConflictsDesc')}</div>
          <div className="mt-4 flex gap-2">
            <Button onClick={runMerge} disabled={merging}>
              <GitMerge className="size-4" />
              {merging ? t('merge.mergingProgress') : t('branches.confirmMerge')}
            </Button>
            <Button variant="secondary" onClick={backToBranches} disabled={merging}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {state.status === 'ready' && state.preview.has_conflicts && (
        <>
          <Card className="border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="size-4" />
              {t('merge.conflictsDetected')}
            </div>
            <div className="mt-1 text-sm text-amber-800">
              {state.preview.conflicts.length} {t('merge.conflictsCount')} {t('merge.conflictHint')}
            </div>
          </Card>

          <div className="space-y-3">
            {state.preview.conflicts.map((conflict) => (
              <ConflictRow
                key={conflict.score_id}
                conflict={conflict}
                scoreTitle={scoreTitle(conflict.score_id)}
                fromName={state.preview.from_branch.name}
                intoName={state.preview.into_branch.name}
                choice={resolutions[conflict.score_id]}
                onChoose={(choice) =>
                  setResolutions((prev) => ({ ...prev, [conflict.score_id]: choice }))
                }
              />
            ))}
          </div>

          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              {Object.keys(resolutions).length}/{state.preview.conflicts.length}{' '}
              {t('merge.resolvedCount')}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={backToBranches} disabled={merging}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={runMerge}
                disabled={
                  merging ||
                  state.preview.conflicts.some((c) => !resolutions[c.score_id])
                }
              >
                <GitMerge className="size-4" />
                {merging ? t('merge.mergingProgress') : t('merge.confirmResolved')}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ConflictRow({
  conflict,
  scoreTitle,
  fromName,
  intoName,
  choice,
  onChoose,
}: {
  conflict: ApiMergeConflict
  scoreTitle: string
  fromName: string
  intoName: string
  choice: MergeConflictResolution | undefined
  onChoose: (choice: MergeConflictResolution) => void
}) {
  const { t } = useTranslation()
  const oursPath = conflict.ours?.storage_path ?? t('merge.notPresent')
  const theirsPath = conflict.theirs?.storage_path ?? t('merge.notPresent')

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-semibold text-slate-900">{scoreTitle}</div>
        <Badge tone={choice ? 'success' : 'warn'}>
          {choice ? t('merge.resolved') : t('merge.unresolved')}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          active={choice === 'ours'}
          onClick={() => onChoose('ours')}
          label={t('merge.keepOurs')}
          branchName={intoName}
          path={oursPath}
        />
        <ChoiceCard
          active={choice === 'theirs'}
          onClick={() => onChoose('theirs')}
          label={t('merge.takeTheirs')}
          branchName={fromName}
          path={theirsPath}
        />
      </div>
    </Card>
  )
}

function ChoiceCard({
  active,
  onClick,
  label,
  branchName,
  path,
}: {
  active: boolean
  onClick: () => void
  label: string
  branchName: string
  path: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid size-4 place-items-center rounded-full border ${
            active ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
          }`}
        >
          {active && <span className="size-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-medium text-slate-900">{label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge tone="info">{branchName}</Badge>
      </div>
      <div className="mt-1 truncate font-mono text-xs text-slate-500" title={path}>
        {path}
      </div>
    </button>
  )
}
