'use client'

import { showSuccess, showError } from '@/components/ui/sonner'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    const message = description ? `${title}: ${description}` : title

    if (variant === 'destructive') {
      showError(message)
    } else {
      showSuccess(message)
    }
  }

  return { toast }
}
