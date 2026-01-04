'use client'

import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      toastOptions={{
        duration: 5000,
        classNames: {
          success: 'bg-green-50 text-green-800 border-green-200',
          error: 'bg-red-50 text-red-800 border-red-200',
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-green-600" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <CircleXIcon className="size-5 text-red-600" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// Helper functions for consistent toast behavior
const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 5000,
  })
}

const showError = (message: string) => {
  toast.error(message, {
    duration: Infinity,
    closeButton: true,
  })
}

export { Toaster, showSuccess, showError }
