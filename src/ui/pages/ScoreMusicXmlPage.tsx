import { useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import type { Score } from '../../types'
import { Badge } from '../primitives/Badge'
import { Button } from '../primitives/Button'
import { Card } from '../primitives/Card'
import { Modal } from '../primitives/Modal'
import { cn } from '../utils/cn'
import {
  ArrowLeft,
  Braces,
  Download,
  Eraser,
  Hand,
  Hash,
  Maximize2,
  Minus,
  MousePointer2,
  Music2,
  Pencil,
  Redo2,
  Save,
  SlidersHorizontal,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

type ScoreXmlEntry = {
  title: string
  composer: string
  xmlUrl: string
}

type EditTool =
  | 'select'
  | 'pan'
  | 'note'
  | 'rest'
  | 'sharp'
  | 'flat'
  | 'slur'
  | 'dynamic'
  | 'fingering'
  | 'text'
  | 'eraser'

type Annotation = {
  id: string
  tool: EditTool
  label: string
  x: number
  y: number
}

type RenderStatus = 'idle' | 'loading' | 'ready' | 'error'

const SCORE_XML_MAP: Record<string, ScoreXmlEntry> = {
  's-canon-v1': {
    title: 'Symphony No.9, Op.95 - Violin II Part',
    composer: 'Antonin Dvorak',
    xmlUrl: '/musicxml/dvorak-sym9-violin2.musicxml',
  },
  's-canon-v2': {
    title: 'Symphony No.9, Op.95 - Violin I Part',
    composer: 'Antonin Dvorak',
    xmlUrl: '/musicxml/dvorak-sym9-violin1.musicxml',
  },
  's-canon-full': {
    title: 'Symphony No.9, Op.95 - Full Score',
    composer: 'Antonin Dvorak',
    xmlUrl: '/musicxml/dvorak-sym9-full-score.musicxml',
  },
}

const TOOL_COPY: Record<EditTool, { label: string; mark: string }> = {
  select: { label: 'Select', mark: 'Select' },
  pan: { label: 'Pan', mark: 'Pan' },
  note: { label: 'Note', mark: 'note' },
  rest: { label: 'Rest', mark: 'rest' },
  sharp: { label: 'Sharp', mark: '#' },
  flat: { label: 'Flat', mark: 'b' },
  slur: { label: 'Slur', mark: 'slur' },
  dynamic: { label: 'Dynamic', mark: 'mf' },
  fingering: { label: 'Fingering', mark: '2' },
  text: { label: 'Text', mark: 'text' },
  eraser: { label: 'Eraser', mark: 'erase' },
}

function nowTimestamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function annotationLabel(tool: EditTool, customText: string, fingering: string) {
  if (tool === 'text') return customText.trim() || TOOL_COPY.text.mark
  if (tool === 'fingering') return fingering.trim() || TOOL_COPY.fingering.mark
  return TOOL_COPY[tool].mark
}

export function ScoreMusicXmlPage() {
  const { projectId, songId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser, getProject, addCommit, addToast } = useAppState()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const zoomRef = useRef(100)

  const project = projectId ? getProject(projectId) : undefined
  const song = useMemo(
    () => project?.songs?.find((s) => s.id === songId),
    [project, songId],
  )

  const availableScores = useMemo(() => {
    if (!project || !song) return []
    return song.scoreIds
      .map((id) => project.scores.find((s) => s.id === id))
      .filter((score): score is Score => !!score && !!SCORE_XML_MAP[score.id])
  }, [project, song])

  const defaultScoreId = availableScores[0]?.id ?? 's-canon-v1'
  const scoreId = searchParams.get('scoreId') ?? defaultScoreId
  const score = project?.scores.find((s) => s.id === scoreId)
  const xmlEntry = SCORE_XML_MAP[scoreId] ?? SCORE_XML_MAP[defaultScoreId]

  const [status, setStatus] = useState<RenderStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [tool, setTool] = useState<EditTool>('select')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [showMeasureNumbers, setShowMeasureNumbers] = useState(true)
  const [showPartNames, setShowPartNames] = useState(true)
  const [compactLayout, setCompactLayout] = useState(true)
  const [customText, setCustomText] = useState('bowing')
  const [fingering, setFingering] = useState('2')
  const [commitOpen, setCommitOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('Edited MusicXML markings')
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    if (!xmlEntry || !containerRef.current) return

    let cancelled = false
    const container = containerRef.current

    async function renderScore() {
      setStatus('loading')
      setError(null)
      container.innerHTML = ''

      const osmd = new OpenSheetMusicDisplay(container, {
        autoResize: true,
        backend: 'svg',
        drawComposer: true,
        drawCredits: true,
        drawMeasureNumbers: showMeasureNumbers,
        drawPartNames: showPartNames,
        drawingParameters: compactLayout ? 'compacttight' : 'default',
        pageBackgroundColor: '#ffffff',
      })

      osmdRef.current = osmd
      osmd.loadUrlTimeout = 15000

      try {
        const response = await fetch(xmlEntry.xmlUrl)
        if (!response.ok) {
          throw new Error(`Failed to load MusicXML (${response.status})`)
        }
        const xml = await response.text()
        await osmd.load(xml, xmlEntry.title)
        if (cancelled) return
        osmd.Zoom = zoomRef.current / 100
        osmd.render()
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Unable to render MusicXML')
      }
    }

    void renderScore()

    return () => {
      cancelled = true
    }
  }, [compactLayout, showMeasureNumbers, showPartNames, xmlEntry])

  useEffect(() => {
    if (status !== 'ready' || !osmdRef.current) return
    osmdRef.current.Zoom = zoom / 100
    osmdRef.current.render()
  }, [status, zoom])

  if (!project || !song) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">MusicXML score not found</div>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => navigate('/projects')}>
              Back to projects
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId)

  function changeScore(nextScoreId: string) {
    setAnnotations([])
    setSelectedAnnotationId(null)
    setSearchParams({ scoreId: nextScoreId })
  }

  function placeAnnotation(event: React.MouseEvent<HTMLDivElement>) {
    if (!surfaceRef.current) return
    if (tool === 'select' || tool === 'pan') return

    if (tool === 'eraser') {
      if (selectedAnnotationId) {
        setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId))
        setSelectedAnnotationId(null)
        setUndoCount((count) => count + 1)
        addToast({ title: 'Marking removed' })
        return
      }
      setAnnotations((prev) => prev.slice(0, -1))
      setUndoCount((count) => count + 1)
      addToast({ title: 'Last marking removed' })
      return
    }

    const rect = surfaceRef.current.getBoundingClientRect()
    const next: Annotation = {
      id: `a-${Date.now()}`,
      tool,
      label: annotationLabel(tool, customText, fingering),
      x: event.clientX - rect.left + surfaceRef.current.scrollLeft,
      y: event.clientY - rect.top + surfaceRef.current.scrollTop,
    }
    setAnnotations((prev) => [...prev, next])
    setSelectedAnnotationId(next.id)
    setUndoCount((count) => count + 1)
    setRedoCount(0)
  }

  function undoAnnotation() {
    setAnnotations((prev) => prev.slice(0, -1))
    setUndoCount((count) => Math.max(0, count - 1))
    setRedoCount((count) => count + 1)
    setSelectedAnnotationId(null)
  }

  function redoAnnotation() {
    setRedoCount((count) => Math.max(0, count - 1))
    setUndoCount((count) => count + 1)
    addToast({ title: 'Redo queued (prototype)', message: 'The annotation stack is visual-only.' })
  }

  function resetView() {
    setZoom(100)
    surfaceRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate(`/projects/${project.id}?tab=scores`)}
              >
                <ArrowLeft className="size-4" />
                Scores
              </Button>
              <div className="truncate text-sm font-semibold text-slate-900">
                {xmlEntry.title}
              </div>
              <Badge tone="info">MusicXML</Badge>
              <Badge>{score?.instrument === 'full' ? 'Full score' : score?.instrument}</Badge>
              <Badge>Branch: {project.currentBranch}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {xmlEntry.composer} · {score?.currentVersion ?? 'working copy'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scoreId}
              onChange={(event) => changeScore(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              aria-label="Score part"
            >
              {availableScores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => window.open(xmlEntry.xmlUrl, '_blank', 'noopener,noreferrer')}>
              <Download className="size-4" />
              XML
            </Button>
            <Button onClick={() => setCommitOpen(true)}>
              <Save className="size-4" />
              Commit
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <ToolButton
            active={tool === 'select'}
            icon={<MousePointer2 className="size-4" />}
            label={TOOL_COPY.select.label}
            onClick={() => setTool('select')}
          />
          <ToolButton
            active={tool === 'pan'}
            icon={<Hand className="size-4" />}
            label={TOOL_COPY.pan.label}
            onClick={() => setTool('pan')}
          />
          <Divider />
          <ToolButton
            active={tool === 'note'}
            icon={<Music2 className="size-4" />}
            label={TOOL_COPY.note.label}
            onClick={() => setTool('note')}
          />
          <ToolButton
            active={tool === 'rest'}
            icon={<Braces className="size-4" />}
            label={TOOL_COPY.rest.label}
            onClick={() => setTool('rest')}
          />
          <ToolButton
            active={tool === 'sharp'}
            icon={<Hash className="size-4" />}
            label={TOOL_COPY.sharp.label}
            onClick={() => setTool('sharp')}
          />
          <ToolButton
            active={tool === 'flat'}
            icon={<Minus className="size-4" />}
            label={TOOL_COPY.flat.label}
            onClick={() => setTool('flat')}
          />
          <ToolButton
            active={tool === 'slur'}
            icon={<Pencil className="size-4" />}
            label={TOOL_COPY.slur.label}
            onClick={() => setTool('slur')}
          />
          <ToolButton
            active={tool === 'dynamic'}
            icon={<SlidersHorizontal className="size-4" />}
            label={TOOL_COPY.dynamic.label}
            onClick={() => setTool('dynamic')}
          />
          <ToolButton
            active={tool === 'fingering'}
            icon={<Hash className="size-4" />}
            label={TOOL_COPY.fingering.label}
            onClick={() => setTool('fingering')}
          />
          <ToolButton
            active={tool === 'text'}
            icon={<Type className="size-4" />}
            label={TOOL_COPY.text.label}
            onClick={() => setTool('text')}
          />
          <ToolButton
            active={tool === 'eraser'}
            icon={<Eraser className="size-4" />}
            label={TOOL_COPY.eraser.label}
            onClick={() => setTool('eraser')}
          />

          <Divider />

          <IconButton title="Zoom out" onClick={() => setZoom((value) => Math.max(60, value - 10))}>
            <ZoomOut className="size-4" />
          </IconButton>
          <div className="min-w-14 text-center text-sm font-medium text-slate-700">{zoom}%</div>
          <IconButton title="Zoom in" onClick={() => setZoom((value) => Math.min(180, value + 10))}>
            <ZoomIn className="size-4" />
          </IconButton>
          <IconButton title="Reset view" onClick={resetView}>
            <Maximize2 className="size-4" />
          </IconButton>

          <Divider />

          <IconButton title="Undo" disabled={annotations.length === 0} onClick={undoAnnotation}>
            <Undo2 className="size-4" />
          </IconButton>
          <IconButton title="Redo" disabled={redoCount === 0} onClick={redoAnnotation}>
            <Redo2 className="size-4" />
          </IconButton>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showMeasureNumbers}
                onChange={(event) => setShowMeasureNumbers(event.target.checked)}
              />
              Measures
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showPartNames}
                onChange={(event) => setShowPartNames(event.target.checked)}
              />
              Parts
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={compactLayout}
                onChange={(event) => setCompactLayout(event.target.checked)}
              />
              Compact
            </label>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="text-sm font-semibold text-slate-900">Inspector</div>
          <div className="mt-3 grid gap-3">
            <div>
              <div className="text-xs font-medium text-slate-500">Active tool</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{TOOL_COPY[tool].label}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Text</div>
              <input
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Fingering</div>
              <input
                value={fingering}
                onChange={(event) => setFingering(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Selected mark</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {selectedAnnotation?.label ?? '-'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Working copy</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone={annotations.length ? 'warn' : 'neutral'}>
                  {annotations.length} marks
                </Badge>
                <Badge>Undo: {undoCount}</Badge>
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={annotations.length === 0}
              onClick={() => {
                setAnnotations([])
                setSelectedAnnotationId(null)
                addToast({ title: 'Annotations cleared' })
              }}
            >
              Clear markings
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div
            ref={surfaceRef}
            className={cn(
              'relative h-full overflow-auto bg-slate-200 p-6',
              tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
            )}
            onClick={placeAnnotation}
          >
            <div className="mx-auto min-h-full w-fit min-w-[760px] rounded-md bg-white p-6 shadow-sm">
              {status === 'loading' && (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                  Rendering MusicXML...
                </div>
              )}
              {status === 'error' && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  {error}
                </div>
              )}
              <div
                ref={containerRef}
                className={cn(
                  'musicxml-stage min-h-96',
                  status !== 'ready' && 'pointer-events-none opacity-30',
                )}
              />
            </div>

            {annotations.map((annotation) => (
              <button
                key={annotation.id}
                type="button"
                className={cn(
                  'absolute rounded-md border px-2 py-1 text-xs font-semibold shadow-sm transition',
                  annotation.tool === 'dynamic' && 'border-sky-200 bg-sky-50 text-sky-800',
                  annotation.tool === 'fingering' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  annotation.tool === 'slur' && 'border-violet-200 bg-violet-50 text-violet-800',
                  !['dynamic', 'fingering', 'slur'].includes(annotation.tool) &&
                    'border-amber-200 bg-amber-50 text-amber-900',
                  selectedAnnotationId === annotation.id && 'ring-2 ring-slate-900',
                )}
                style={{ left: annotation.x, top: annotation.y }}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedAnnotationId(annotation.id)
                  setTool('select')
                }}
              >
                {annotation.label}
              </button>
            ))}
          </div>
        </main>
      </div>

      <Modal
        title="Commit MusicXML edits"
        open={commitOpen}
        onClose={() => setCommitOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCommitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                addCommit(project.id, {
                  projectId: project.id,
                  branch: project.currentBranch,
                  message: commitMessage || 'Edited MusicXML markings',
                  authorUserId: currentUser.id,
                  timestamp: nowTimestamp(),
                  changedScoreId: scoreId,
                })
                setCommitOpen(false)
                addToast({
                  title: 'MusicXML commit created',
                  message: `${annotations.length} visual markings`,
                })
                navigate(`/projects/${project.id}?tab=versions`)
              }}
            >
              Commit
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-sm font-medium text-slate-800">Message</div>
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            MusicXML rendering is real; annotation write-back is still prototype state.
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}

function IconButton({
  children,
  title,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      {...props}
      type="button"
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
        props.className,
      )}
    >
      {children}
    </button>
  )
}
