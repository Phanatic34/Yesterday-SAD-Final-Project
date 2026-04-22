export type UserRole = 'regular' | 'owner' | 'admin'

export type Instrument =
  | 'violin'
  | 'viola'
  | 'cello'
  | 'flute'
  | 'clarinet'
  | 'trumpet'
  | 'piano'

export type ProjectRole =
  | 'owner'
  | 'conductor'
  | 'section leader'
  | 'performer'
  | 'editor'

export type FileType = 'musescore' | 'pdf (deferred)'

export type User = {
  id: string
  name: string
  role: UserRole
  intro: string
  avatarUrl?: string
}

export type ProjectMember = {
  userId: string
  roles: ProjectRole[]
  instruments: Instrument[]
}

export type Score = {
  id: string
  projectId: string
  name: string
  instrument: Instrument
  fileType: FileType
  currentVersion: string
  lastEditorUserId: string
  lastUpdatedAt: string
}

export type Commit = {
  id: string
  projectId: string
  branch: string
  message: string
  authorUserId: string
  timestamp: string
  changedScoreId?: string
}

export type Project = {
  id: string
  name: string
  description: string
  ensembleType: string
  members: ProjectMember[]
  scores: Score[]
  branches: string[]
  currentBranch: string
  currentCommitId: string
  commits: Commit[]
  lastUpdatedAt: string
}

