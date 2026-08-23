import { useEffect, useState } from 'react'
import { Loader2, Radar, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { IssueCluster, ToolActivity } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

const TYPE_BADGE: Record<string, 'danger' | 'warning' | 'info' | 'violet'> = {
  sla_risk: 'danger',
  recurring_complaint: 'warning',
  cross_customer: 'info',
  unusual_activity: 'violet',
}

const TYPE_LABEL: Record<string, string> = {
  sla_risk: 'SLA risk',
  recurring_complaint: 'Recurring complaint',
  cross_customer: 'Cross-customer',
  unusual_activity: 'Unusual activity',
}

export function IssuesView() {
  const [issues, setIssues] = useState<IssueCluster[] | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [investigating, setInvestigating] = useState<string | null>(null)
  const [investigation, setInvestigation] = useState<{
    issue: IssueCluster
    result: { answer: string; toolActivity: ToolActivity[]; confidence: string }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setIssues(await api.issues())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const detect = async () => {
    setDetecting(true)
    try {
      await api.detectIssues()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDetecting(false)
    }
  }

  const investigate = async (issue: IssueCluster) => {
    setInvestigating(issue.issueId)
    try {
      const result = await api.investigate(issue.issueId)
      setInvestigation({ issue, result })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setInvestigating(null)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Issue Dashboard</h1>
          <p className="text-xs text-slate-500">
            Deterministic detection hypotheses — not confirmed facts
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={detect} disabled={detecting}>
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-run detection
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        {!issues && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {issues && issues.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-slate-400">
              <Radar className="h-8 w-8" />
              <p className="mt-2 text-sm">No issues detected yet. Run detection.</p>
            </CardContent>
          </Card>
        )}
        {issues?.map((issue) => (
          <Card key={issue.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={TYPE_BADGE[issue.type] ?? 'secondary'}>
                    {TYPE_LABEL[issue.type] ?? issue.type}
                  </Badge>
                  <Badge
                    variant={
                      issue.severity === 'P1' ? 'danger' : issue.severity === 'P2' ? 'warning' : 'secondary'
                    }
                  >
                    {issue.severity}
                  </Badge>
                  <span className="text-xs text-slate-400">conf {(Number(issue.confidence) * 100).toFixed(0)}%</span>
                </div>
                <span className="font-mono text-xs text-slate-400">{issue.issueId}</span>
              </div>
              <CardTitle className="text-sm">{issue.title}</CardTitle>
              {issue.summary && <CardDescription className="text-xs">{issue.summary}</CardDescription>}
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                {issue.affectedCustomers.map((c) => (
                  <Badge key={c.accountId} variant="outline">
                    {c.accountId}
                  </Badge>
                ))}
                <span className="ml-1">
                  {issue.relatedTickets.length} ticket(s)
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => investigate(issue)}
                disabled={investigating === issue.issueId}
              >
                {investigating === issue.issueId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Investigate
              </Button>
            </CardContent>
          </Card>
        ))}

        {investigation && (
          <Card className="border-blue-300 bg-blue-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Investigation · {investigation.issue.issueId}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setInvestigation(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    investigation.result.confidence === 'HIGH'
                      ? 'success'
                      : investigation.result.confidence === 'MEDIUM'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  Confidence: {investigation.result.confidence}
                </Badge>
              </div>
              <div className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700">
                {investigation.result.answer}
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-medium text-slate-500">
                  Tool activity ({investigation.result.toolActivity.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {investigation.result.toolActivity.map((a, i) => (
                    <div key={i} className="rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-500">
                      {a.name} {a.ok ? '✓' : '✗'} {JSON.stringify(a.input)}
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}