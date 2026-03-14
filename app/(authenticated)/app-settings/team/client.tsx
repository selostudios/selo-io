'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { inviteInternalEmployee, removeInternalEmployee } from './actions'

interface InternalEmployee {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  lastSignIn: string | null
  createdAt: string
}

interface TeamClientProps {
  employees: InternalEmployee[]
  isAdmin: boolean
  currentUserId: string
}

function formatName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ')
  return name || '—'
}

function formatLastSignIn(lastSignIn: string | null): string {
  if (!lastSignIn) return 'Never'
  return new Date(lastSignIn).toLocaleDateString()
}

export function TeamClient({ employees, isAdmin, currentUserId }: TeamClientProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleInvite() {
    if (!email.trim()) return

    startTransition(async () => {
      const result = await inviteInternalEmployee(email.trim())
      if (result.success) {
        toast.success('Invite sent successfully')
        setEmail('')
        setInviteOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to send invite')
      }
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeInternalEmployee(userId)
      if (result.success) {
        toast.success('Employee removed successfully')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to remove employee')
      }
    })
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button data-testid="invite-employee-button">Invite Employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="employee@selo.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="invite-email-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleInvite}
                  disabled={isPending || !email.trim()}
                  data-testid="send-invite-button"
                >
                  {isPending ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Last Sign In</TableHead>
            {isAdmin && <TableHead className="w-[100px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id} data-testid={`employee-row-${employee.userId}`}>
              <TableCell>{formatName(employee.firstName, employee.lastName)}</TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>{formatLastSignIn(employee.lastSignIn)}</TableCell>
              {isAdmin && (
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={employee.userId === currentUserId || isPending}
                        data-testid={`remove-employee-button-${employee.userId}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will revoke their internal access and delete their account. This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(employee.userId)}
                          data-testid={`confirm-remove-button-${employee.userId}`}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
