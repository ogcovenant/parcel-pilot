import { AlertTriangle, Bot, User } from 'lucide-react'
import type { ChatMessage } from '../../lib/types'
import { Badge } from '../ui/badge'
import { ActionCard } from './action-card'
import { ToolActivity } from './tool-activity'

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'danger',
}

export function Message({
  message,
  onActionExecuted,
}: {
  message: ChatMessage
  onActionExecuted: (m: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
        {isUser ? <User className="h-4 w-4 text-slate-500" /> : <Bot className="h-4 w-4 text-slate-700" />}
      </div>
      <div className="min-w-0 max-w-[85%] flex-1">
        <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
          {message.requiresHumanReview && (
            <div className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Requires human review
            </div>
          )}

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {message.content}
          </div>

          <ToolActivity items={message.activity ?? []} />

          {message.preparedAction && (
            <ActionCard action={message.preparedAction} onExecuted={onActionExecuted} />
          )}
        </div>

        {(message.confidence || (message.sources && message.sources.length > 0)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {message.confidence && (
              <Badge variant={CONFIDENCE_VARIANT[message.confidence] ?? 'secondary'}>
                Confidence: {message.confidence}
              </Badge>
            )}
            {(message.sources ?? []).slice(0, 3).map((s, i) => (
              <Badge key={i} variant="outline" className="max-w-[220px] truncate">
                {s.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}