import { BookOpen, FileText, ShieldCheck } from 'lucide-react'
import type { ChatMessage, SourceRef } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

function Source({ source }: { source: SourceRef }) {
  const isOperational = source.type === 'Operational Data'
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 p-2">
      {isOperational ? (
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      ) : (
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-800">{source.name}</div>
        <div className="text-[11px] text-slate-400">
          {isOperational ? 'Operational Data' : source.type}
          {source.section ? ` · ${source.section}` : ''}
        </div>
      </div>
    </div>
  )
}

export function EvidencePanel({ message }: { message: ChatMessage | null }) {
  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
        <ShieldCheck className="h-8 w-8" />
        <p className="mt-2 text-xs">Evidence and sources appear here</p>
      </div>
    )
  }

  const sources: SourceRef[] = message.sources ?? []
  const evidence = message.evidence

  return (
    <div className="space-y-3">
      {message.confidence && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs">Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Confidence:</span>
              <Badge
                variant={
                  message.confidence === 'HIGH'
                    ? 'success'
                    : message.confidence === 'MEDIUM'
                      ? 'warning'
                      : 'danger'
                }
              >
                {message.confidence}
              </Badge>
            </div>
            {evidence?.decision && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Verdict:</span>
                <Badge variant="outline">{evidence.decision}</Badge>
              </div>
            )}
            {message.requiresHumanReview && (
              <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                Human review recommended
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs">Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {sources.length === 0 ? (
            <p className="text-xs text-slate-400">No sources recorded.</p>
          ) : (
            sources.map((s, i) => <Source key={i} source={s} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}