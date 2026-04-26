import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStateProvider } from './state/AppState'
import { AppLayout } from './ui/layout/AppLayout'
import { AdminDashboardPage } from './ui/pages/AdminDashboardPage'
import { HomePage } from './ui/pages/HomePage'
import { LoginPage } from './ui/pages/LoginPage'
import { ProjectDetailPage } from './ui/pages/ProjectDetailPage'
import { ProjectsPage } from './ui/pages/ProjectsPage'
import { ScoreEditorPage } from './ui/pages/ScoreEditorPage'
import { ScorePdfViewPage } from './ui/pages/ScorePdfViewPage'
import { UserProfilePage } from './ui/pages/UserProfilePage'

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route
              path="projects/:projectId/scores/:scoreId/editor"
              element={<ScoreEditorPage />}
            />
            <Route
              path="projects/:projectId/songs/:songId/pdf"
              element={<ScorePdfViewPage />}
            />
            <Route path="users/:userId" element={<UserProfilePage />} />
            <Route path="admin" element={<AdminDashboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}
