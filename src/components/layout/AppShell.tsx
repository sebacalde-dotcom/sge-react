import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CicloProvider } from '@/contexts/CicloContext'

export function AppShell() {
  return (
    <CicloProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-page)' }}>
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar institutionName="SGE" />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </CicloProvider>
  )
}
