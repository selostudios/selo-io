'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
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
import { inviteInternalEmployee, removeInternalEmployee, updateInternalEmployee } from './actions'

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
  const [editEmployee, setEditEmployee] = useState<InternalEmployee | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
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

  function handleEdit(employee: InternalEmployee) {
    setEditEmployee(employee)
    setEditFirstName(employee.firstName ?? '')
    setEditLastName(employee.lastName ?? '')
  }

  function handleSaveEdit() {
    if (!editEmployee || !editFirstName.trim()) return

    startTransition(async () => {
      const result = await updateInternalEmployee(
        editEmployee.userId,
        editFirstName.trim(),
        editLastName.trim()
      )
      if (result.success) {
        toast.success('Employee updated successfully')
        setEditEmployee(null)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to update employee')
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(employee)}
                      disabled={isPending}
                      data-testid={`edit-employee-button-${employee.userId}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          disabled={
                            employee.userId === currentUserId || employees.length <= 1 || isPending
                          }
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
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First name</Label>
              <Input
                id="edit-first-name"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="First name"
                data-testid="edit-first-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last name</Label>
              <Input
                id="edit-last-name"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Last name"
                data-testid="edit-last-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmployee(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isPending || !editFirstName.trim()}
              data-testid="save-employee-button"
            >
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
