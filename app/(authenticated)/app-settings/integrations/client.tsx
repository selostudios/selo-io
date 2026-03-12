'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bot, Mail, Gauge, KeyRound, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateAppSetting, removeAppSetting, testAppConnection, updateEmailConfig } from './actions'

interface AppSettingDisplay {
  key: string
  configured: boolean
  maskedValue: string | null
  updatedAt: string | null
  updatedByEmail: string | null
}

const PROVIDERS = [
  {
    key: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI API for audits and reports',
    icon: Bot,
    placeholder: 'sk-ant-...',
    testable: true,
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Transactional email delivery',
    icon: Mail,
    placeholder: 're_...',
    testable: true,
  },
  {
    key: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Google PageSpeed API for performance audits',
    icon: Gauge,
    placeholder: 'AIza...',
    testable: true,
  },
  {
    key: 'cron_secret',
    name: 'Cron Secret',
    description: 'Bearer token for cron job authentication',
    icon: KeyRound,
    testable: false,
    placeholder: '',
  },
] as const

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    return date.toLocaleDateString()
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m ago`
  }
  return 'just now'
}

interface IntegrationsClientProps {
  settings: AppSettingDisplay[]
  isAdmin: boolean
}

export function IntegrationsClient({ settings, isAdmin }: IntegrationsClientProps) {
  const router = useRouter()
  const settingsMap = new Map(settings.map((s) => [s.key, s]))
  const emailConfig = settingsMap.get('email_config')

  return (
    <div className="space-y-6">
      {PROVIDERS.map((provider) => {
        const setting = settingsMap.get(provider.key)
        return (
          <ProviderCard
            key={provider.key}
            provider={provider}
            setting={setting ?? null}
            isAdmin={isAdmin}
            onMutationSuccess={() => router.refresh()}
          />
        )
      })}

      <EmailConfigCard
        setting={emailConfig ?? null}
        isAdmin={isAdmin}
        onMutationSuccess={() => router.refresh()}
      />
    </div>
  )
}

interface ProviderCardProps {
  provider: (typeof PROVIDERS)[number]
  setting: AppSettingDisplay | null
  isAdmin: boolean
  onMutationSuccess: () => void
}

function ProviderCard({ provider, setting, isAdmin, onMutationSuccess }: ProviderCardProps) {
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState(false)

  const configured = setting?.configured ?? false
  const Icon = provider.icon

  async function handleUpdateKey() {
    if (!newValue.trim()) return
    setSaving(true)
    try {
      const result = await updateAppSetting(provider.key, newValue.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${provider.name} key updated successfully`)
        setUpdateDialogOpen(false)
        setNewValue('')
        onMutationSuccess()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const result = await removeAppSetting(provider.key)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${provider.name} credential removed`)
        onMutationSuccess()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setRemoving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const result = await testAppConnection(provider.key)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="text-muted-foreground h-5 w-5" />
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription>{provider.description}</CardDescription>
            </div>
          </div>
          <Badge variant={configured ? 'default' : 'secondary'}>
            {configured ? 'Configured' : 'Not configured'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {configured && setting?.maskedValue && (
              <p className="text-muted-foreground font-mono text-sm">{setting.maskedValue}</p>
            )}
            {configured && setting?.updatedAt && (
              <p className="text-muted-foreground text-xs">
                Updated {formatRelativeTime(setting.updatedAt)}
                {setting.updatedByEmail && ` by ${setting.updatedByEmail}`}
              </p>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {provider.testable && configured && (
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Test Connection
                </Button>
              )}

              <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    {configured ? 'Update Key' : 'Add Key'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {configured ? 'Update' : 'Add'} {provider.name} Key
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    <Label htmlFor={`key-${provider.key}`}>API Key</Label>
                    <Input
                      id={`key-${provider.key}`}
                      type="password"
                      placeholder={provider.placeholder}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpdateKey} disabled={saving || !newValue.trim()}>
                      {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {configured && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={removing}>
                      {removing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Remove
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {provider.name} credential?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this credential? Any features that depend on
                        this service will stop working until a new key is configured.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface EmailConfigCardProps {
  setting: AppSettingDisplay | null
  isAdmin: boolean
  onMutationSuccess: () => void
}

function EmailConfigCard({ setting, isAdmin, onMutationSuccess }: EmailConfigCardProps) {
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState(setting?.maskedValue ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!fromName.trim() || !fromEmail.trim()) return
    setSaving(true)
    try {
      const result = await updateEmailConfig(fromName.trim(), fromEmail.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Email configuration updated')
        onMutationSuccess()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Configuration</CardTitle>
        <CardDescription>
          Configure the sender name and email for transactional emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from-name">From Name</Label>
            <Input
              id="from-name"
              placeholder="Selo"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-email">From Email</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="hello@selo.io"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving || !fromName.trim() || !fromEmail.trim()}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
