'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { completeOAuthConnection, cancelOAuthConnection } from '../actions'
import type { Account } from '@/lib/oauth/types'

interface SelectAccountContentProps {
  accounts: Account[]
  platformName: string
  orgId: string
}

export function SelectAccountContent({
  accounts,
  platformName,
  orgId,
}: SelectAccountContentProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleConnect() {
    if (!selectedId) return
    setSaving(true)

    const result = await completeOAuthConnection(selectedId)

    if (result && 'error' in result) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    toast.success(`${platformName} connected successfully`)
    router.push(`/${orgId}/settings/integrations`)
  }

  async function handleCancel() {
    await cancelOAuthConnection()
    router.push(`/${orgId}/settings/integrations`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select {platformName} Account</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your login has access to multiple {platformName} accounts. Choose the one to connect.
        </p>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => (
          <Card
            key={account.id}
            data-testid={`account-option-${account.id}`}
            className={`cursor-pointer transition-colors ${
              selectedId === account.id
                ? 'border-primary ring-primary/20 ring-2'
                : 'hover:border-muted-foreground/30'
            }`}
            onClick={() => setSelectedId(account.id)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <Building2 className="text-muted-foreground h-5 w-5 shrink-0" />
              <span className="flex-1 font-medium">{account.name}</span>
              {selectedId === account.id && (
                <Check className="text-primary h-5 w-5 shrink-0" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleConnect} disabled={!selectedId || saving}>
          {saving ? 'Connecting...' : 'Connect'}
        </Button>
      </div>
    </div>
  )
}
