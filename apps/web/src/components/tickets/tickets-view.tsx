import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { TicketDetail } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Skeleton } from '../ui/skeleton'

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'secondary',
}

export function TicketsView() {
  const [tickets, setTickets] = useState<TicketDetail[] | null>(null)
  const [selected, setSelected] = useState<TicketDetail | null>(null)
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    api.tickets().then(setTickets)
  }, [])

  const filtered = useMemo(() => {
    if (!tickets) return []
    return tickets.filter(
      (t) =>
        (severity === 'all' || t.severity === severity) &&
        (status === 'all' || t.status === status),
    )
  }, [tickets, severity, status])

  if (!tickets) {
    return (
      <div className="p-6">
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-sm font-semibold text-slate-900">Tickets</h1>
        <p className="text-xs text-slate-500">Structured operational data</p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-2">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-slate-400">{filtered.length} ticket(s)</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {filtered.map((t) => (
          <Card
            key={t.ticketId}
            className={`cursor-pointer transition-colors hover:border-slate-400 ${
              selected?.ticketId === t.ticketId ? 'border-slate-500' : ''
            }`}
            onClick={() => setSelected(t)}
          >
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-1 pt-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium">{t.ticketId}</span>
                {t.severity && <Badge variant={SEVERITY_VARIANT[t.severity]}>{t.severity}</Badge>}
                <Badge variant={t.status === 'open' ? 'warning' : 'secondary'}>{t.status}</Badge>
              </div>
              <span className="text-xs text-slate-400">{t.accountId}</span>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-sm font-medium text-slate-800">{t.subject}</div>
              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{t.description}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                <span>Assigned: {t.assignedTo}</span>
                <span>·</span>
                <span>Channel: {t.channel}</span>
                {t.slaDueAt && (
                  <>
                    <span>·</span>
                    <span>SLA due: {new Date(t.slaDueAt).toLocaleString()}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}