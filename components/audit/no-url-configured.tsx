import Link from 'next/link'
import { Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NoUrlConfigured() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">SEO / AIO Audit</h1>
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Globe className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle>Website URL not configured</CardTitle>
          <CardDescription>Add your website URL to enable SEO & AI auditing.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/settings/organization">Set Up</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
