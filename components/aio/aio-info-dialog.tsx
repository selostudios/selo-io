'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Info } from 'lucide-react'

export function AIOInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
          aria-label="Learn about AIO Audits"
        >
          <Info className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>About AIO Audits</DialogTitle>
          <DialogDescription>
            Understanding Artificial Intelligence Optimization and how we analyze customer content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium text-foreground">What is AIO?</p>
            <p className="text-muted-foreground">
              Artificial Intelligence Optimization (AIO) is the practice of optimizing content for AI
              systems like ChatGPT, Claude, Perplexity, and Gemini. These AI engines need different
              signals than traditional search engines.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">What we check:</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                <strong className="font-medium text-foreground">Technical Foundation:</strong> AI
                crawler access, schema markup, page speed
              </li>
              <li>
                <strong className="font-medium text-foreground">Content Structure:</strong> FAQ
                sections, comparison tables, step-by-step guides
              </li>
              <li>
                <strong className="font-medium text-foreground">Content Quality:</strong> Data
                sourcing, expert credibility, comprehensiveness
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">How it works:</p>
            <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
              <li>We crawl the customer website and analyze its structure</li>
              <li>Run 20 programmatic checks for technical validation (fast, $0 cost)</li>
              <li>Use AI to analyze content quality on the selected sample of pages</li>
              <li>Provide actionable recommendations to improve citability</li>
            </ol>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">Sample Size:</strong> You control how
              many pages are analyzed by AI. We automatically select the most important pages based
              on depth, freshness, and content type. Higher sample sizes provide more comprehensive
              analysis but increase cost and time.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
