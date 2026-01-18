import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-[420px] text-center">
        <div className="mb-8 flex justify-center">
          <Image
            src="/selo-logo.jpg.webp"
            alt="Selo"
            width={200}
            height={80}
            priority
            className="object-contain"
          />
        </div>

        <h1 className="mb-4 text-2xl font-semibold text-neutral-900">Access Denied</h1>

        <p className="text-muted-foreground mb-8">
          Access to this application is by invitation only. If you believe you should have access,
          please contact your organization administrator.
        </p>

        <Button asChild variant="outline">
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </div>
  )
}
