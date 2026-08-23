import { useState } from 'react'
import { Sidebar, type View } from './components/layout/sidebar'
import { ChatView } from './components/chat/chat-view'
import { IssuesView } from './components/issues/issues-view'
import { TicketsView } from './components/tickets/tickets-view'

export default function App() {
  const [view, setView] = useState<View>('chat')

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar view={view} onNavigate={setView} />
      <main className="flex min-w-0 flex-1">
        {view === 'chat' && <ChatView />}
        {view === 'issues' && <IssuesView />}
        {view === 'tickets' && <TicketsView />}
      </main>
    </div>
  )
}