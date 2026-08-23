import { useEffect, useState } from 'react'
import { api, loadStoredUser, setCurrentUser } from '../lib/api'
import type { User } from '../lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Badge } from './ui/badge'

export function UserSelect() {
  const [users, setUsers] = useState<User[]>([])
  const [current, setCurrent] = useState<User | null>(null)

  useEffect(() => {
    api.users().then((u) => {
      setUsers(u)
      const email = loadStoredUser()
      setCurrent(u.find((x) => x.email === email) ?? u[0])
    })
  }, [])

  const onSelect = (email: string) => {
    setCurrent(users.find((x) => x.email === email) ?? null)
    setCurrentUser(email)
    window.location.reload()
  }

  const roleLabel: Record<string, string> = {
    support_agent: 'Support Agent',
    support_manager: 'Manager',
    operations: 'Operations',
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Signed in as</span>
        {current && (
          <Badge variant={current.role === 'support_manager' ? 'violet' : 'secondary'}>
            {roleLabel[current.role]}
          </Badge>
        )}
      </div>
      <Select value={current?.email ?? ''} onValueChange={onSelect}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.email} value={u.email}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && (
        <p className="text-[11px] leading-tight text-slate-400">
          {current.accountId
            ? `Scoped to ${current.accountId}`
            : 'Cross-account access'}
        </p>
      )}
    </div>
  )
}