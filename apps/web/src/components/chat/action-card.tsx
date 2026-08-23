import { useState } from 'react'
import { CheckCircle2, XCircle, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import type { PreparedAction } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

export function ActionCard({
  action,
  onExecuted,
}: {
  action: PreparedAction
  onExecuted: (message: string) => void
}) {
  const [state, setState] = useState<'pending' | 'executing' | 'done' | 'rejected'>('pending')
  const [executedRef, setExecutedRef] = useState<string | null>(null)

  const actionLabel =
    action.actionType === 'escalation'
      ? 'Create HIGH priority escalation'
      : action.actionType === 'ticket_update'
        ? 'Apply ticket update'
        : 'Create follow-up task'

  const confirm = async (confirmed: boolean) => {
    setState('executing')
    try {
      let ref = action.referenceId
      if (action.actionType === 'escalation') {
        const res = await api.executeEscalation(action.referenceId, confirmed)
        ref = (res as { referenceId: string }).referenceId
      } else if (action.actionType === 'follow_up_task') {
        const res = await api.executeFollowUp(action.referenceId, confirmed)
        ref = (res as { referenceId: string }).referenceId
      } else {
        const res = await api.executeTicketUpdate(action.referenceId, confirmed)
        ref = (res as { referenceId: string }).referenceId
      }
      setExecutedRef(ref)
      setState(confirmed ? 'done' : 'rejected')
      onExecuted(
        confirmed
          ? `✓ ${actionLabel} executed. Reference: ${ref}`
          : `✗ ${actionLabel} cancelled.`,
      )
    } catch (e) {
      setState('rejected')
      onExecuted(`Execution failed: ${(e as Error).message}`)
    }
  }

  const summary = action.summary as Record<string, unknown>

  return (
    <Card className="mt-3 border-amber-300 bg-amber-50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-sm">Proposed Action</CardTitle>
          <Badge variant="warning">Awaiting confirmation</Badge>
        </div>
        <CardDescription className="text-xs text-amber-700">
          Preparing an action is not executing it. Review and confirm below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500">Action:</span>{' '}
            <span className="font-medium">{actionLabel}</span>
          </div>
          <div>
            <span className="text-slate-500">Reference:</span>{' '}
            <span className="font-mono">{action.referenceId}</span>
          </div>
          {Boolean(summary.ticketId) && (
            <div>
              <span className="text-slate-500">Ticket:</span>{' '}
              <span className="font-mono">{String(summary.ticketId)}</span>
            </div>
          )}
          {Boolean(summary.priority) && (
            <div>
              <span className="text-slate-500">Priority:</span>{' '}
              <Badge variant={summary.priority === 'P1' ? 'danger' : 'warning'}>
                {String(summary.priority)}
              </Badge>
            </div>
          )}
          {Boolean(summary.targetTeam) && (
            <div>
              <span className="text-slate-500">Team:</span>{' '}
              <span className="font-medium">{String(summary.targetTeam)}</span>
            </div>
          )}
          {Boolean(summary.reason) && (
            <div className="col-span-2">
              <span className="text-slate-500">Reason:</span>{' '}
              <span className="text-slate-700">{String(summary.reason)}</span>
            </div>
          )}
        </div>

        {state === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="success" onClick={() => confirm(true)}>
              <CheckCircle2 className="h-4 w-4" /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => confirm(false)}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          </div>
        )}
        {state === 'executing' && (
          <p className="text-xs text-slate-500">Executing…</p>
        )}
        {state === 'done' && (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {actionLabel} executed. Reference: {executedRef ?? action.referenceId}
          </p>
        )}
        {state === 'rejected' && (
          <p className="text-xs font-medium text-slate-500">
            Action not executed — confirmation was declined.
          </p>
        )}
      </CardContent>
    </Card>
  )
}