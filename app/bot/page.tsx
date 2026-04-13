import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SeloBot - Site Audit Crawler',
  description: 'Information about SeloBot, the website auditing crawler operated by Selo.',
}

export default function BotPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold">SeloBot</h1>

      <p className="text-muted-foreground mb-8">
        SeloBot is a website auditing crawler operated by{' '}
        <a href="https://selostudios.com" className="text-foreground underline">
          Selo Studios
        </a>
        . It crawls websites to perform SEO, performance, and AI-readiness audits for Selo Studios
        customers and perspectives.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">User-Agent</h2>
        <pre className="bg-muted rounded-md px-4 py-3 text-sm">
          SeloBot/1.0 (Site Audit; +https://selo.io/bot)
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Behavior</h2>
        <ul className="text-muted-foreground list-inside list-disc space-y-2">
          <li>Respects robots.txt directives (Disallow, Allow, Crawl-delay)</li>
          <li>Enforces a minimum 500ms delay between requests</li>
          <li>Honors Crawl-delay directives up to 2 seconds</li>
          <li>Crawls only internal links within the target domain</li>
          <li>Does not submit forms, execute JavaScript, or store cookies</li>
          <li>Typically crawls 50&ndash;200 pages per audit</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Infrastructure</h2>
        <p className="text-muted-foreground">
          SeloBot runs on Vercel&apos;s serverless infrastructure. IP addresses are dynamic and
          shared across Vercel&apos;s edge network. The most reliable way to identify SeloBot is by
          its User-Agent string.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Whitelisting</h2>
        <p className="text-muted-foreground mb-3">
          If your firewall is blocking SeloBot, whitelist it by User-Agent string:
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-medium">robots.txt</h3>
            <pre className="bg-muted rounded-md px-4 py-3 text-sm">
              {`User-agent: SeloBot\nAllow: /`}
            </pre>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Cloudflare WAF</h3>
            <p className="text-muted-foreground text-sm">
              Security &rarr; WAF &rarr; Custom Rules &rarr; Add rule to allow requests where
              User-Agent contains &quot;SeloBot&quot;.
            </p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Sucuri</h3>
            <p className="text-muted-foreground text-sm">
              Dashboard &rarr; Firewall &rarr; Whitelist &rarr; Add User-Agent &quot;SeloBot&quot;.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          If SeloBot is causing issues on your site, please contact us at{' '}
          <a href="mailto:dev@selostudios.com" className="text-foreground underline">
            dev@selostudios.com
          </a>
          .
        </p>
      </section>
    </div>
  )
}
