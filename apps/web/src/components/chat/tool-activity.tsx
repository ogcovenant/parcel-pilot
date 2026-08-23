import { useState } from 'react'
import {
  Calculator,
  Check,
  FileSearch,
  ShieldX,
  Wrench,
  X,
} from 'lucide-react'
import type { ToolActivity } from '../../lib/types'
import { cn } from '../../lib/utils'

const TOOL_META: Record<string, { icon: typeof Wrench; label: string }> = {
  search_documents: { icon: FileSearch, label: 'Searching documents' },
  get_account: { icon: Check, label: 'Looking up account' },
  get_order: { icon: Check, label: 'Looking up order' },
  get_ticket: { icon: Check, label: 'Looking up ticket' },
  search_tickets: { icon: Check, label: 'Searching tickets' },
  calculate_sla: { icon: Calculator, label: 'Calculating SLA' },
  calculate_cancellation: { icon: Calculator, label: 'Calculating cancellation' },
  calculate_service_credit: { icon: Calculator, label: 'Calculating service credit' },
  prepare_escalation: { icon: Wrench, label: 'Preparing escalation' },
  prepare_ticket_update: { icon: Wrench, label: 'Preparing ticket update' },
  prepare_follow_up_task: { icon: Wrench, label: 'Preparing follow-up task' },
}

export function ToolActivity({ items }: { items: ToolActivity[] }) {
  const [open, setOpen] = useState(true)
  if (!items || items.length === 0) return null

  return (
    <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <span>Tool activity ({items.length})</span>
        <span>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="space-y-1">
          {items.map((item, i) => {
            const meta = TOOL_META[item.name]
            const Icon = meta?.icon ?? Wrench
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md px-2 py-1 text-xs',
                  item.denied
                    ? 'bg-red-50 text-red-700'
                    : item.ok
                      ? 'bg-white text-slate-600'
                      : 'bg-amber-50 text-amber-700',
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {meta?.label ?? item.name}
                    {item.denied && <ShieldX className="ml-1 inline h-3 w-3" />}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                    {JSON.stringify(item.input)}
                  </div>
                  {!item.ok && (
                    <div className="mt-0.5 text-[11px]">
                      {(item.output as { error?: string }).error}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-0.5 shrink-0',
                    item.ok ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}