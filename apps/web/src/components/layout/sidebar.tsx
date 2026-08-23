import { Bot, ListChecks, MessageSquare, ShieldAlert } from 'lucide-react'
import { cn } from '../../lib/utils'
import { UserSelect } from '../user-select'

export type View = 'chat' | 'issues' | 'tickets'

const NAV: Array<{ id: View; label: string; icon: typeof MessageSquare }> = [
  { id: 'chat', label: 'Support Copilot', icon: MessageSquare },
  { id: 'issues', label: 'Issues', icon: ShieldAlert },
  { id: 'tickets', label: 'Tickets', icon: ListChecks },
]

export function Sidebar({
  view,
  onNavigate,
}: {
  view: View
  onNavigate: (v: View) => void
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">ParcelPilot</div>
          <div className="text-xs text-slate-500">Support Intelligence</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <UserSelect />
      </div>
    </aside>
  )
}