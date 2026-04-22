import type { Commit, Project, Score, User } from '../types'

export const mockUsers: User[] = [
  {
    id: 'u-regular',
    name: 'Ava Lin',
    role: 'regular',
    intro: 'Performer focusing on clean, consistent markings across parts.',
  },
  {
    id: 'u-owner',
    name: 'Michael Jackson',
    role: 'owner',
    intro: 'Group leader coordinating parts, roles, and score revisions.',
    avatarUrl:
      'https://1984pop.com/wp-content/uploads/2014/04/mj-thriller-1984.jpg?w=625',
  },
  {
    id: 'u-admin',
    name: 'Admin Account',
    role: 'admin',
    intro: 'Prototype admin: can manage users and projects (simulated).',
  },
  {
    id: 'u-guest1',
    name: 'Mia Park',
    role: 'regular',
    intro: 'Section leader, detail-oriented about bowing/fingering consistency.',
  },
]

const baseCommits: Commit[] = [
  {
    id: 'c-1',
    projectId: 'p-spring',
    branch: 'main',
    message: 'Synced flute phrasing with conductor notes',
    authorUserId: 'u-owner',
    timestamp: '2026-04-20 19:42',
    changedScoreId: 's-flute',
  },
  {
    id: 'c-2',
    projectId: 'p-spring',
    branch: 'violin-section-revision',
    message: 'Updated violin bowing for measures 12–18',
    authorUserId: 'u-guest1',
    timestamp: '2026-04-21 21:08',
    changedScoreId: 's-violin',
  },
  {
    id: 'c-3',
    projectId: 'p-spring',
    branch: 'bowing-update',
    message: 'Adjusted cello fingering in rehearsal section B',
    authorUserId: 'u-regular',
    timestamp: '2026-04-22 09:12',
    changedScoreId: 's-cello',
  },
]

function score(
  partial: Omit<Score, 'projectId' | 'lastUpdatedAt'> & {
    projectId: string
    lastUpdatedAt?: string
  },
): Score {
  return {
    ...partial,
    lastUpdatedAt: partial.lastUpdatedAt ?? '2026-04-22 09:12',
  }
}

export const mockProjects: Project[] = [
  {
    id: 'p-spring',
    name: 'Spring Concert 2026',
    description:
      'Concert planning: assign members, manage parts, and track Git-like revisions.',
    ensembleType: 'orchestra',
    members: [
      {
        userId: 'u-owner',
        roles: ['owner', 'conductor'],
        instruments: ['piano'],
      },
      {
        userId: 'u-regular',
        roles: ['performer', 'editor'],
        instruments: ['cello'],
      },
      {
        userId: 'u-guest1',
        roles: ['section leader', 'editor'],
        instruments: ['violin'],
      },
    ],
    scores: [
      score({
        id: 's-violin',
        projectId: 'p-spring',
        name: 'Violin I — Part',
        instrument: 'violin',
        fileType: 'musescore',
        currentVersion: 'v1.3',
        lastEditorUserId: 'u-guest1',
      }),
      score({
        id: 's-cello',
        projectId: 'p-spring',
        name: 'Cello — Part',
        instrument: 'cello',
        fileType: 'musescore',
        currentVersion: 'v1.1',
        lastEditorUserId: 'u-regular',
      }),
      score({
        id: 's-flute',
        projectId: 'p-spring',
        name: 'Flute — Part',
        instrument: 'flute',
        fileType: 'musescore',
        currentVersion: 'v1.0',
        lastEditorUserId: 'u-owner',
      }),
      score({
        id: 's-pdf',
        projectId: 'p-spring',
        name: 'Reference PDF (planned)',
        instrument: 'viola',
        fileType: 'pdf (deferred)',
        currentVersion: '—',
        lastEditorUserId: 'u-owner',
        lastUpdatedAt: '2026-04-18 10:03',
      }),
    ],
    branches: ['main', 'violin-section-revision', 'bowing-update'],
    currentBranch: 'main',
    currentCommitId: baseCommits[0].id,
    commits: baseCommits,
    lastUpdatedAt: '2026-04-22 09:12',
  },
  {
    id: 'p-quartet',
    name: 'String Quartet Practice',
    description: 'Weekly rehearsal planning and part cleanup.',
    ensembleType: 'chamber group',
    members: [
      { userId: 'u-owner', roles: ['owner', 'editor'], instruments: ['violin'] },
      {
        userId: 'u-regular',
        roles: ['performer'],
        instruments: ['cello'],
      },
    ],
    scores: [
      score({
        id: 's-q-violin',
        projectId: 'p-quartet',
        name: 'Violin — Part',
        instrument: 'violin',
        fileType: 'musescore',
        currentVersion: 'v0.9',
        lastEditorUserId: 'u-owner',
        lastUpdatedAt: '2026-04-19 15:20',
      }),
    ],
    branches: ['main'],
    currentBranch: 'main',
    currentCommitId: 'c-q-1',
    commits: [
      {
        id: 'c-q-1',
        projectId: 'p-quartet',
        branch: 'main',
        message: 'Initial import of quartet parts',
        authorUserId: 'u-owner',
        timestamp: '2026-04-19 15:20',
        changedScoreId: 's-q-violin',
      },
    ],
    lastUpdatedAt: '2026-04-19 15:20',
  },
  {
    id: 'p-wind',
    name: 'Wind Ensemble Rehearsal',
    description: 'Rehearsal set prep, annotations, and version tracking.',
    ensembleType: 'band',
    members: [{ userId: 'u-admin', roles: ['owner'], instruments: ['clarinet'] }],
    scores: [
      score({
        id: 's-w-clarinet',
        projectId: 'p-wind',
        name: 'Clarinet — Part',
        instrument: 'clarinet',
        fileType: 'musescore',
        currentVersion: 'v2.0',
        lastEditorUserId: 'u-admin',
        lastUpdatedAt: '2026-04-17 18:05',
      }),
    ],
    branches: ['main', 'phrasing-pass'],
    currentBranch: 'main',
    currentCommitId: 'c-w-1',
    commits: [
      {
        id: 'c-w-1',
        projectId: 'p-wind',
        branch: 'main',
        message: 'Imported clarinet part and baseline markings',
        authorUserId: 'u-admin',
        timestamp: '2026-04-17 18:05',
        changedScoreId: 's-w-clarinet',
      },
    ],
    lastUpdatedAt: '2026-04-17 18:05',
  },
]

