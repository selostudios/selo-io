'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, type buttonVariants } from '@/components/ui/button'
import type { VariantProps } from 'class-variance-authority'

interface LoadingButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  label?: string
  loadingLabel?: string
  icon?: React.ReactNode
}

function LoadingButton({
  loading = false,
  label,
  loadingLabel,
  icon,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          {loadingLabel ?? label ?? children}
        </>
      ) : (
        <>
          {icon}
          {label ?? children}
        </>
      )}
    </Button>
  )
}

export { LoadingButton }
