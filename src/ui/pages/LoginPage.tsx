import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../state/AppState'
import { Card } from '../primitives/Card'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'

export function LoginPage() {
  const { currentUser, switchUser, addToast } = useAppState()
  const navigate = useNavigate()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Login / Account (mock)</div>
        <div className="mt-1 text-sm text-slate-600">
          This is a prototype-only screen. No real authentication is performed.
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-slate-800">Account</div>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="demo@example.com"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              addToast({ title: 'Logged in (simulated)', message: 'Use the role switcher below.' })
              navigate('/')
            }}
          >
            Login
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAccount('')
              setPassword('')
            }}
          >
            Clear
          </Button>
          <Badge tone="info">Current: {currentUser.name}</Badge>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">Demo scenario selector</div>
        <div className="mt-1 text-sm text-slate-600">
          Demo-only control: changes visible permissions for presentation/testing. Real users cannot self-assign roles.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={currentUser.role === 'regular' ? 'primary' : 'secondary'}
            onClick={() => switchUser('regular')}
          >
            regular user
          </Button>
          <Button
            variant={currentUser.role === 'owner' ? 'primary' : 'secondary'}
            onClick={() => switchUser('owner')}
          >
            project owner
          </Button>
          <Button
            variant={currentUser.role === 'admin' ? 'primary' : 'secondary'}
            onClick={() => switchUser('admin')}
          >
            admin
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="font-medium">What changes by role?</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
            <li>Owner can invite members, assign roles/instruments, create/switch/merge branches.</li>
            <li>Regular users can edit their assigned parts and view members, but cannot merge.</li>
            <li>Admin can access the admin dashboard and delete users/projects (simulated).</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

