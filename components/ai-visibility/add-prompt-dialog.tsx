'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addPrompt } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'
import type { AIVisibilityTopic } from '@/lib/ai-visibility/types'

interface AddPromptDialogProps {
  orgId: string
  existingTopics: AIVisibilityTopic[]
  defaultPromptText?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const NEW_TOPIC_VALUE = '__new__'

export function AddPromptDialog({
  orgId,
  existingTopics,
  defaultPromptText,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: AddPromptDialogProps) {
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const dialogOpen = isControlled ? openProp : internalOpen
  const setDialogOpen = isControlled ? (onOpenChangeProp ?? setInternalOpen) : setInternalOpen

  const [isPending, startTransition] = useTransition()
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [newTopicName, setNewTopicName] = useState('')
  const [promptText, setPromptText] = useState(defaultPromptText ?? '')

  const isNewTopic = selectedTopicId === NEW_TOPIC_VALUE

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const topicName = isNewTopic ? newTopicName.trim() : undefined
    const topicId = isNewTopic ? undefined : selectedTopicId

    if (isNewTopic && !topicName) {
      toast.error('Please enter a topic name')
      return
    }
    if (!promptText.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    startTransition(async () => {
      const result = await addPrompt(orgId, {
        topicName: topicName ?? '',
        topicId,
        promptText: promptText.trim(),
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Prompt added')
      setDialogOpen(false)
      setSelectedTopicId('')
      setNewTopicName('')
      setPromptText(defaultPromptText ?? '')
    })
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Prompt
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Prompt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic..." />
              </SelectTrigger>
              <SelectContent>
                {existingTopics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_TOPIC_VALUE}>+ Create new topic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNewTopic && (
            <div className="space-y-2">
              <Label htmlFor="topicName">Topic Name</Label>
              <Input
                id="topicName"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g., Prescription Glasses"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., What are the best online retailers for prescription glasses?"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Adding...' : 'Add Prompt'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
