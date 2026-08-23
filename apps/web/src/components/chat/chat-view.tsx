import { useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { api } from '../../lib/api'
import type { ChatMessage } from '../../lib/types'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { EvidencePanel } from './evidence-panel'
import { Message } from './message'

const SUGGESTIONS = [
  'Can Northstar cancel ORD-1001 without a cancellation fee?',
  'A pickup is three hours late because of carrier fault. Should I get a service credit?',
  'Why is ticket TKT-502 still unresolved?',
  'Find high-severity tickets approaching SLA.',
  'Are multiple customers reporting the same product issue?',
  'Prepare an escalation for TKT-501.',
]

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const history = messages
      .filter((m) => m.role === 'user' || m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content },
      { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true },
    ])
    setLoading(true)

    try {
      const result = await api.chat(content, history)
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.pending) {
          next[next.length - 1] = {
            id: last.id,
            role: 'assistant',
            content: result.error ?? result.answer,
            activity: result.toolActivity,
            sources: result.sources,
            confidence: result.confidence,
            evidence: result.evidence,
            preparedAction: result.preparedAction,
            requiresHumanReview: result.requiresHumanReview,
            pending: false,
          }
        }
        return next
      })
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.pending) {
          next[next.length - 1] = {
            id: last.id,
            role: 'assistant',
            content: `Error: ${(e as Error).message}`,
            pending: false,
          }
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const onActionExecuted = (message: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: message },
    ])
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.pending)
  const lastAssistantIndex = lastAssistant ? messages.indexOf(lastAssistant) : null
  const selected = selectedIndex !== null ? messages[selectedIndex] : lastAssistant

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-sm font-semibold text-slate-900">Support Copilot</h1>
          <p className="text-xs text-slate-500">
            Authorized internal assistant for ParcelPilot support &amp; operations
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl pt-8 text-center">
              <h2 className="text-lg font-semibold text-slate-800">
                How can I help you today?
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ask about cancellations, service credits, SLAs, tickets, or detected issues.
              </p>
              <div className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} message={m} onActionExecuted={onActionExecuted} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 px-1 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Investigating…
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about a customer, order, ticket, SLA, or policy…"
              className="max-h-40 min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            <Button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="h-[44px] w-[44px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidence
          </h2>
          {lastAssistantIndex !== null && (
            <button
              onClick={() => setSelectedIndex(selectedIndex === lastAssistantIndex ? null : lastAssistantIndex)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              {selectedIndex === lastAssistantIndex ? 'Show latest' : 'Latest answer'}
            </button>
          )}
        </div>
        <EvidencePanel message={selected ?? null} />
      </aside>
    </div>
  )
}