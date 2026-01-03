# Selo OS MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant marketing performance dashboard that tracks campaigns across HubSpot, Google Analytics, and LinkedIn with automated AI-powered weekly summaries.

**Architecture:** Next.js 14 App Router with React Server Components, Supabase for PostgreSQL + Auth + RLS, Vercel Edge Functions for API routes, Vercel Cron for weekly automation, Anthropic Claude via Vercel AI SDK for summary generation.

**Tech Stack:** Next.js 14+, TypeScript, React, Tailwind CSS, Shadcn UI, Supabase, Vercel, Anthropic Claude

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

**Step 1: Initialize Next.js with TypeScript**

Run:
```bash
cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/mvp-implementation
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Answer prompts:
- Would you like to use ESLint? → Yes
- Would you like to use Turbopack? → No
- Would you like to customize the default import alias? → No

Expected: Creates Next.js project with App Router, TypeScript, Tailwind

**Step 2: Verify development server works**

Run:
```bash
npm run dev
```

Expected: Server starts on http://localhost:3000
Visit: http://localhost:3000 - should see Next.js welcome page

Stop server: Ctrl+C

**Step 3: Install core dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D @types/node
```

Expected: Dependencies installed successfully

**Step 4: Install Shadcn UI**

Run:
```bash
npx shadcn@latest init
```

Answer prompts:
- Would you like to use TypeScript? → yes
- Which style? → New York
- Which color? → Neutral
- Where is your global CSS file? → app/globals.css
- Would you like to use CSS variables? → yes
- Where is your tailwind.config? → tailwind.config.ts
- Configure import alias? → @/components

Expected: Shadcn UI configured with components directory

**Step 5: Install initial Shadcn components**

Run:
```bash
npx shadcn@latest add button card input label select table toast tabs dropdown-menu avatar badge
```

Expected: Components installed in `components/ui/`

**Step 6: Commit**

Run:
```bash
git add .
git commit -m "feat: initialize Next.js project with Shadcn UI

- Next.js 14 with App Router and TypeScript
- Tailwind CSS configured
- Shadcn UI with neutral theme
- Core UI components installed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Supabase Setup

**Files:**
- Create: `.env.local`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

**Step 1: Create Supabase project**

Manual step (document for engineer):
1. Go to https://supabase.com/dashboard
2. Create new project: "selo-os-dev"
3. Save credentials:
   - Project URL
   - Anon public key
   - Service role key (keep secret)

**Step 2: Create environment variables file**

Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Step 3: Add .env.local to .gitignore**

Verify `.gitignore` contains:
```
.env*.local
```

(Already in .gitignore from earlier, no change needed)

**Step 4: Create Supabase client utilities**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 5: Create Supabase server utilities**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Server component - can't set cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Server component - can't remove cookies
          }
        },
      },
    }
  )
}
```

**Step 6: Create middleware for auth**

Create `middleware.ts`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 7: Commit**

Run:
```bash
git add lib/ middleware.ts .gitignore
git commit -m "feat: configure Supabase client and auth middleware

- Browser and server Supabase clients
- Auth middleware for session management
- Environment variables configured

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Database Schema Setup

**Files:**
- Create: `supabase/migrations/20260102000001_initial_schema.sql`

**Step 1: Create Supabase migrations directory**

Run:
```bash
mkdir -p supabase/migrations
```

**Step 2: Create initial schema migration**

Create `supabase/migrations/20260102000001_initial_schema.sql`:
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'team_member', 'client_viewer');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'completed');
CREATE TYPE platform_type AS ENUM ('hubspot', 'google_analytics', 'linkedin', 'meta', 'instagram');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai', 'none');
CREATE TYPE ai_billing_model AS ENUM ('bring_own_key', 'platform_billed', 'disabled');

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  industry TEXT,
  contact_info JSONB DEFAULT '{}',
  brand_preferences JSONB DEFAULT '{}',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#F5F5F0',
  accent_color TEXT DEFAULT '#666666',
  default_weekly_report_recipients TEXT[] DEFAULT '{}',
  ai_provider ai_provider DEFAULT 'anthropic',
  ai_api_key TEXT, -- Will be encrypted
  ai_billing_model ai_billing_model DEFAULT 'platform_billed',
  ai_features_enabled JSONB DEFAULT '{"weekly_summaries": true}',
  data_export_history JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client_viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invites table
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  status invite_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status campaign_status DEFAULT 'draft',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  weekly_report_recipients TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform connections table
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform_type platform_type NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted API keys/tokens
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, platform_type)
);

-- Campaign metrics table (time-series data)
CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  platform_type platform_type NOT NULL,
  date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly summaries table
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  summary_data JSONB NOT NULL,
  recipients TEXT[] NOT NULL,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_organization ON invites(organization_id);
CREATE INDEX idx_campaigns_organization ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_platform_connections_org ON platform_connections(organization_id);
CREATE INDEX idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_metrics(date);
CREATE INDEX idx_campaign_metrics_campaign_date ON campaign_metrics(campaign_id, date);
CREATE INDEX idx_weekly_summaries_org ON weekly_summaries(organization_id);
CREATE INDEX idx_weekly_summaries_date ON weekly_summaries(week_start_date);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- RLS Policies for invites
CREATE POLICY "Admins can manage invites in their organization"
  ON invites FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and team members can manage campaigns"
  ON campaigns FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'team_member')
    )
  );

-- RLS Policies for platform_connections
CREATE POLICY "Users can view platform connections in their organization"
  ON platform_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage platform connections"
  ON platform_connections FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for campaign_metrics
CREATE POLICY "Users can view metrics for campaigns in their organization"
  ON campaign_metrics FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for weekly_summaries
CREATE POLICY "Users can view summaries in their organization"
  ON weekly_summaries FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON platform_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Step 3: Apply migration to Supabase**

Manual step (document for engineer):

Option A - Using Supabase Dashboard:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of migration file
3. Run SQL

Option B - Using Supabase CLI (recommended):
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to your project
supabase link --project-ref your_project_ref

# Push migration
supabase db push
```

**Step 4: Verify schema in Supabase Dashboard**

Manual verification:
1. Go to Supabase Dashboard → Table Editor
2. Verify tables exist: organizations, users, invites, campaigns, platform_connections, campaign_metrics, weekly_summaries
3. Go to Authentication → Policies
4. Verify RLS policies are active

**Step 5: Commit**

Run:
```bash
git add supabase/
git commit -m "feat: create initial database schema with RLS

- Organizations, users, campaigns, platform connections
- Campaign metrics (time-series data)
- Weekly summaries
- Invite system
- Row-Level Security policies for multi-tenancy
- Indexes for query performance

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Authentication

### Task 4: Auth Configuration

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/sign-out/route.ts`
- Modify: Supabase Dashboard (manual)

**Step 1: Configure OAuth providers in Supabase**

Manual step (document for engineer):
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Email provider (should be enabled by default)
3. Enable Google provider:
   - Create Google OAuth app: https://console.cloud.google.com/
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase
4. Enable Azure (Microsoft) provider:
   - Create Azure AD app: https://portal.azure.com/
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Application ID and Client Secret to Supabase
5. Configure site URL: `http://localhost:3000` (development)
6. Add redirect URLs: `http://localhost:3000/auth/callback`

**Step 2: Create auth callback handler**

Create `app/auth/callback/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return error page
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

**Step 3: Create sign-out handler**

Create `app/auth/sign-out/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login', request.url))
}
```

**Step 4: Commit**

Run:
```bash
git add app/auth/
git commit -m "feat: configure auth callback and sign-out handlers

- OAuth callback handler for Google and Microsoft
- Sign-out route handler
- Redirect to dashboard after successful auth

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Login Page UI

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `components/auth/login-form.tsx`

**Step 1: Create login actions**

Create `app/login/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithEmail(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signInWithOAuth(provider: 'google' | 'azure') {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}
```

**Step 2: Create login form component**

Create `components/auth/login-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { signInWithEmail, signInWithOAuth } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleEmailSignIn(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await signInWithEmail(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  async function handleOAuthSignIn(provider: 'google' | 'azure') {
    setIsLoading(true)
    setError(null)

    const result = await signInWithOAuth(provider)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Selo OS</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthSignIn('google')}
            disabled={isLoading}
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthSignIn('azure')}
            disabled={isLoading}
          >
            Continue with Microsoft
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create login page**

Create `app/login/page.tsx`:
```typescript
import { LoginForm } from '@/components/auth/login-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If already logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <LoginForm />
    </div>
  )
}
```

**Step 4: Update environment variables**

Add to `.env.local`:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Step 5: Test login page**

Run:
```bash
npm run dev
```

Visit: http://localhost:3000/login
Expected: See login form with email/password fields and OAuth buttons

Stop server: Ctrl+C

**Step 6: Commit**

Run:
```bash
git add app/login/ components/auth/ .env.local
git commit -m "feat: add login page with email and OAuth authentication

- Email/password login form
- Google and Microsoft OAuth buttons
- Server actions for authentication
- Redirect to dashboard after login
- Minimal design matching Selo Studios aesthetic

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Organization & User Management

### Task 6: Create Organization Flow

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/layout.tsx`
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/actions.ts`
- Create: `components/onboarding/create-organization-form.tsx`

**Step 1: Create onboarding actions**

Create `app/onboarding/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData) {
  const name = formData.get('name') as string
  const industry = formData.get('industry') as string

  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      industry,
    })
    .select()
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  // Create user record linking to organization
  const { error: userRecordError } = await supabase
    .from('users')
    .insert({
      id: user.id,
      organization_id: org.id,
      role: 'admin',
    })

  if (userRecordError) {
    return { error: userRecordError.message }
  }

  redirect('/dashboard')
}
```

**Step 2: Create organization form component**

Create `components/onboarding/create-organization-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { createOrganization } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function CreateOrganizationForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await createOrganization(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Your Organization</CardTitle>
        <CardDescription>
          Set up your first client organization to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Badger CPA"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              name="industry"
              type="text"
              placeholder="e.g., Accounting, CPA"
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Organization'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create onboarding page**

Create `app/onboarding/page.tsx`:
```typescript
import { CreateOrganizationForm } from '@/components/onboarding/create-organization-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user already has an organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (userRecord?.organization_id) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <CreateOrganizationForm />
    </div>
  )
}
```

**Step 4: Create dashboard layout**

Create `app/dashboard/layout.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {children}
    </div>
  )
}
```

**Step 5: Create placeholder dashboard page**

Create `app/dashboard/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization:organizations(name)')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">
        Welcome to {userRecord?.organization?.name || 'Selo OS'}
      </h1>
      <p className="mt-4 text-muted-foreground">
        Dashboard coming soon...
      </p>
    </div>
  )
}
```

**Step 6: Update root page to redirect**

Modify `app/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
```

**Step 7: Test onboarding flow**

Run:
```bash
npm run dev
```

Test flow:
1. Visit http://localhost:3000
2. Should redirect to /login
3. Sign in (create test account if needed)
4. Should redirect to /onboarding
5. Create organization
6. Should redirect to /dashboard

Stop server: Ctrl+C

**Step 8: Commit**

Run:
```bash
git add app/onboarding/ app/dashboard/ app/page.tsx components/onboarding/
git commit -m "feat: add organization onboarding flow

- Create organization action
- Onboarding page for first-time users
- Dashboard layout with auth check
- Automatic redirect flow: login → onboarding → dashboard

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: User Invite System

**Files:**
- Create: `app/dashboard/settings/team/page.tsx`
- Create: `app/dashboard/settings/team/actions.ts`
- Create: `components/settings/invite-user-form.tsx`
- Create: `app/accept-invite/[id]/page.tsx`
- Create: `app/accept-invite/[id]/actions.ts`

**Step 1: Create invite actions**

Create `app/dashboard/settings/team/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendInvite(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as 'admin' | 'team_member' | 'client_viewer'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can send invites' }
  }

  // Create invite
  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      email,
      organization_id: userRecord.organization_id,
      role,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // TODO: Send email with invite link
  // For now, just return success with invite link
  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite/${invite.id}`

  revalidatePath('/dashboard/settings/team')

  return {
    success: true,
    inviteLink,
    message: `Invite created! Share this link: ${inviteLink}`
  }
}

export async function deleteInvite(inviteId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/team')
  return { success: true }
}
```

**Step 2: Create invite form component**

Create `components/settings/invite-user-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { sendInvite } from '@/app/dashboard/settings/team/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function InviteUserForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState('client_viewer')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    formData.append('role', role)

    const result = await sendInvite(formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.message || 'Invite sent successfully!')
      // Reset form
      const form = document.querySelector('form') as HTMLFormElement
      form?.reset()
    }

    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
        <CardDescription>
          Send an invitation to join your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="colleague@example.com"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="team_member">Team Member</SelectItem>
                <SelectItem value="client_viewer">Client Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded break-all">
              {success}
            </div>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create team settings page**

Create `app/dashboard/settings/team/page.tsx`:
```typescript
import { InviteUserForm } from '@/components/settings/invite-user-form'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function TeamSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user!.id)
    .single()

  // Get pending invites
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .eq('organization_id', userRecord!.organization_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Get team members
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, role, created_at')
    .eq('organization_id', userRecord!.organization_id)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage your team members and invitations
        </p>
      </div>

      {userRecord?.role === 'admin' && (
        <InviteUserForm />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team Members ({teamMembers?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {teamMembers?.map((member) => (
              <div key={member.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-medium">{member.id}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{member.role.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {invites && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites ({invites.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited {new Date(invite.created_at).toLocaleDateString()}
                      {' • Expires '}{new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{invite.role.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

**Step 4: Create accept invite actions**

Create `app/accept-invite/[id]/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to accept an invite' }
  }

  // Get invite
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .single()

  if (inviteError || !invite) {
    return { error: 'Invite not found' }
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite has expired' }
  }

  // Check if already accepted
  if (invite.status === 'accepted') {
    return { error: 'This invite has already been used' }
  }

  // Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: user.id,
      organization_id: invite.organization_id,
      role: invite.role,
    })

  if (userError) {
    return { error: userError.message }
  }

  // Mark invite as accepted
  await supabase
    .from('invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', inviteId)

  redirect('/dashboard')
}
```

**Step 5: Create accept invite page**

Create `app/accept-invite/[id]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { acceptInvite } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AcceptInvitePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/accept-invite/${params.id}`)
  }

  // Get invite details
  const { data: invite } = await supabase
    .from('invites')
    .select('*, organization:organizations(name)')
    .eq('id', params.id)
    .single()

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite Not Found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const isExpired = new Date(invite.expires_at) < new Date()
  const isAccepted = invite.status === 'accepted'

  async function handleAccept() {
    'use server'
    await acceptInvite(params.id)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>
            You've been invited to join {invite.organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Role:</strong> {invite.role.replace('_', ' ')}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Expires:</strong> {new Date(invite.expires_at).toLocaleDateString()}
            </p>
          </div>

          {isExpired && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              This invite has expired
            </div>
          )}

          {isAccepted && (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
              This invite has already been used
            </div>
          )}

          {!isExpired && !isAccepted && (
            <form action={handleAccept}>
              <Button type="submit" className="w-full">
                Accept Invitation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 6: Test invite flow**

Run:
```bash
npm run dev
```

Test:
1. Login as admin
2. Go to /dashboard/settings/team
3. Send invite
4. Copy invite link
5. Open in incognito/private window
6. Login with different account
7. Accept invite
8. Verify user added to organization

Stop server: Ctrl+C

**Step 7: Commit**

Run:
```bash
git add app/dashboard/settings/ app/accept-invite/ components/settings/
git commit -m "feat: add user invite system

- Send invites with role selection
- Accept invite flow with validation
- Team management page showing members and pending invites
- Automatic expiration after 7 days
- RLS ensures only admins can invite

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Campaign Management

### Task 8: Campaign CRUD

**Files:**
- Create: `app/dashboard/campaigns/page.tsx`
- Create: `app/dashboard/campaigns/actions.ts`
- Create: `app/dashboard/campaigns/[id]/page.tsx`
- Create: `components/campaigns/create-campaign-form.tsx`
- Create: `components/campaigns/campaign-card.tsx`
- Create: `lib/utils/utm.ts`

**Step 1: Create UTM utility functions**

Create `lib/utils/utm.ts`:
```typescript
export function generateUTMParameters(campaignName: string) {
  // Convert campaign name to URL-safe format
  const safeName = campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    utm_source: 'selo',
    utm_medium: 'organic',
    utm_campaign: safeName,
    utm_term: '',
    utm_content: '',
  }
}

export function buildUTMUrl(baseUrl: string, params: {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}) {
  const url = new URL(baseUrl)

  if (params.utm_source) url.searchParams.set('utm_source', params.utm_source)
  if (params.utm_medium) url.searchParams.set('utm_medium', params.utm_medium)
  if (params.utm_campaign) url.searchParams.set('utm_campaign', params.utm_campaign)
  if (params.utm_term) url.searchParams.set('utm_term', params.utm_term)
  if (params.utm_content) url.searchParams.set('utm_content', params.utm_content)

  return url.toString()
}
```

**Step 2: Create campaign actions**

Create `app/dashboard/campaigns/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { generateUTMParameters } from '@/lib/utils/utm'
import { revalidatePath } from 'next/cache'

export async function createCampaign(formData: FormData) {
  const name = formData.get('name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    return { error: 'Permission denied' }
  }

  // Generate UTM parameters
  const utmParams = generateUTMParameters(name)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: userRecord.organization_id,
      name,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'draft',
      ...utmParams,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true, campaign: data }
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const name = formData.get('name') as string
  const status = formData.get('status') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  const supabase = await createClient()

  const { error } = await supabase
    .from('campaigns')
    .update({
      name,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true }
}
```

**Step 3: Create campaign form component**

Create `components/campaigns/create-campaign-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { createCampaign } from '@/app/dashboard/campaigns/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export function CreateCampaignForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await createCampaign(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      router.push(`/dashboard/campaigns/${result.campaign.id}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Campaign</CardTitle>
        <CardDescription>
          Set up a new marketing campaign with tracking parameters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Q1 2026 Thought Leadership"
              required
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                disabled={isLoading}
              />
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create campaign card component**

Create `components/campaigns/campaign-card.tsx`:
```typescript
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type Campaign = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
  }

  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            {campaign.start_date && (
              <p>Starts: {new Date(campaign.start_date).toLocaleDateString()}</p>
            )}
            {campaign.end_date && (
              <p>Ends: {new Date(campaign.end_date).toLocaleDateString()}</p>
            )}
            <p>Created: {new Date(campaign.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

**Step 5: Create campaigns list page**

Create `app/dashboard/campaigns/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { CreateCampaignForm } from '@/components/campaigns/create-campaign-form'
import { CampaignCard } from '@/components/campaigns/campaign-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user!.id)
    .single()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organization_id', userRecord!.organization_id)
    .order('created_at', { ascending: false })

  const canCreateCampaign = ['admin', 'team_member'].includes(userRecord!.role)

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Manage your marketing campaigns and track performance
          </p>
        </div>
      </div>

      {canCreateCampaign && <CreateCampaignForm />}

      <div>
        <h2 className="text-xl font-semibold mb-4">
          All Campaigns ({campaigns?.length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns?.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
          {!campaigns || campaigns.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              No campaigns yet. Create your first campaign to get started!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 6: Create campaign detail page**

Create `app/dashboard/campaigns/[id]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteCampaign } from '../actions'

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!campaign) {
    notFound()
  }

  async function handleDelete() {
    'use server'
    await deleteCampaign(params.id)
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge className="mt-2">{campaign.status}</Badge>
        </div>
        <form action={handleDelete}>
          <Button type="submit" variant="destructive">
            Delete Campaign
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p>{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p>{campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UTM Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_source</span>
              <code className="text-sm">{campaign.utm_source}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_medium</span>
              <code className="text-sm">{campaign.utm_medium}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_campaign</span>
              <code className="text-sm">{campaign.utm_campaign}</code>
            </div>
            {campaign.utm_term && (
              <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
                <span className="font-mono text-sm">utm_term</span>
                <code className="text-sm">{campaign.utm_term}</code>
              </div>
            )}
            {campaign.utm_content && (
              <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
                <span className="font-mono text-sm">utm_content</span>
                <code className="text-sm">{campaign.utm_content}</code>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Use these parameters when creating content in HubSpot, LinkedIn, and other platforms.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Metrics will appear here once platform integrations are connected.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 7: Test campaign flow**

Run:
```bash
npm run dev
```

Test:
1. Go to /dashboard/campaigns
2. Create a new campaign
3. Verify UTM parameters are generated
4. View campaign detail page
5. Delete campaign

Stop server: Ctrl+C

**Step 8: Commit**

Run:
```bash
git add app/dashboard/campaigns/ components/campaigns/ lib/utils/
git commit -m "feat: add campaign management with UTM tracking

- Create, view, and delete campaigns
- Auto-generate UTM parameters from campaign name
- Campaign list with status badges
- Campaign detail page showing UTM codes
- Permission checks (admin/team_member only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Platform Integrations (Foundational)

### Task 9: Platform Connection Management

**Files:**
- Create: `app/dashboard/settings/integrations/page.tsx`
- Create: `app/dashboard/settings/integrations/actions.ts`
- Create: `components/settings/platform-connection-card.tsx`
- Create: `lib/platforms/types.ts`

**Step 1: Create platform types**

Create `lib/platforms/types.ts`:
```typescript
export type PlatformType = 'hubspot' | 'google_analytics' | 'linkedin' | 'meta' | 'instagram'

export type PlatformCredentials = {
  hubspot: {
    api_key: string
  }
  google_analytics: {
    property_id: string
    credentials: object // Service account JSON
  }
  linkedin: {
    access_token: string
    organization_id: string
  }
  meta: {
    access_token: string
    page_id: string
  }
  instagram: {
    access_token: string
    account_id: string
  }
}

export type PlatformConnection = {
  id: string
  organization_id: string
  platform_type: PlatformType
  status: string
  last_sync_at: string | null
  created_at: string
}
```

**Step 2: Create integration actions**

Create `app/dashboard/settings/integrations/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function connectPlatform(formData: FormData) {
  const platform_type = formData.get('platform_type') as string
  const credentials = formData.get('credentials') as string

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can connect platforms' }
  }

  // Parse credentials
  let credentialsObj
  try {
    credentialsObj = JSON.parse(credentials)
  } catch {
    return { error: 'Invalid credentials format' }
  }

  // TODO: Encrypt credentials before storing
  // For MVP, storing as-is (SECURITY: Must encrypt in production!)

  const { error } = await supabase
    .from('platform_connections')
    .upsert({
      organization_id: userRecord.organization_id,
      platform_type,
      credentials: credentialsObj,
      status: 'active',
    }, {
      onConflict: 'organization_id,platform_type'
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/integrations')
  return { success: true }
}

export async function disconnectPlatform(connectionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/integrations')
  return { success: true }
}
```

**Step 3: Create platform connection card**

Create `components/settings/platform-connection-card.tsx`:
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectPlatform } from '@/app/dashboard/settings/integrations/actions'

type Connection = {
  id: string
  platform_type: string
  status: string
  last_sync_at: string | null
}

const platformInfo = {
  hubspot: {
    name: 'HubSpot',
    description: 'Email campaigns, leads, deals, events',
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Website traffic, conversions, UTM tracking',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Post impressions, engagement, followers',
  },
  meta: {
    name: 'Meta (Facebook)',
    description: 'Page insights, post performance',
  },
  instagram: {
    name: 'Instagram',
    description: 'Post impressions, engagement, followers',
  },
}

export function PlatformConnectionCard({ connection }: { connection: Connection | null, platformType: string }) {
  const info = platformInfo[connection?.platform_type as keyof typeof platformInfo || platformType as keyof typeof platformInfo]

  async function handleDisconnect() {
    'use server'
    if (connection) {
      await disconnectPlatform(connection.id)
    }
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{info.name}</CardTitle>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Not connected</Badge>
          <p className="text-sm text-muted-foreground mt-4">
            Connect {info.name} to track performance metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{info.name}</CardTitle>
            <CardDescription>{info.description}</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800">{connection.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection.last_sync_at && (
            <p className="text-sm text-muted-foreground">
              Last synced: {new Date(connection.last_sync_at).toLocaleString()}
            </p>
          )}
          <form action={handleDisconnect}>
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create integrations page**

Create `app/dashboard/settings/integrations/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { PlatformConnectionCard } from '@/components/settings/platform-connection-card'

export default async function IntegrationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('organization_id', userRecord!.organization_id)

  const platforms = ['hubspot', 'google_analytics', 'linkedin', 'meta', 'instagram']

  const connectionsMap = new Map(
    connections?.map(c => [c.platform_type, c]) || []
  )

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your marketing platforms to track campaign performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <PlatformConnectionCard
            key={platform}
            connection={connectionsMap.get(platform) || null}
            platformType={platform}
          />
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Platform connection UI is placeholder for MVP.
          In production, this will include OAuth flows and credential input forms.
        </p>
      </div>
    </div>
  )
}
```

**Step 5: Commit**

Run:
```bash
git add app/dashboard/settings/integrations/ components/settings/platform-connection-card.tsx lib/platforms/
git commit -m "feat: add platform integrations management UI

- Display connected platforms status
- Placeholder for HubSpot, GA, LinkedIn, Meta, Instagram
- Connect/disconnect actions (credentials storage pending)
- Admin-only access via RLS

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Dashboard Navigation

### Task 10: Dashboard Layout with Navigation

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Create: `components/dashboard/sidebar.tsx`
- Create: `components/dashboard/header.tsx`

**Step 1: Create sidebar component**

Create `components/dashboard/sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Campaigns', href: '/dashboard/campaigns' },
  { name: 'Settings', href: '/dashboard/settings/team' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white border-r min-h-screen p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold">Selo OS</h1>
      </div>
      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm font-medium',
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

**Step 2: Create header component**

Create `components/dashboard/header.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export async function Header() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization:organizations(name)')
    .eq('id', user!.id)
    .single()

  const orgName = userRecord?.organization?.name || 'Organization'
  const userEmail = user?.email || ''
  const initials = userEmail.substring(0, 2).toUpperCase()

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold">{orgName}</h2>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <a href="/dashboard/settings/team">Settings</a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <form action="/auth/sign-out" method="post" className="w-full">
              <button type="submit" className="w-full text-left">
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

**Step 3: Update dashboard layout**

Modify `app/dashboard/layout.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    redirect('/onboarding')
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 4: Update dashboard homepage**

Modify `app/dashboard/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization:organizations(name), organization_id')
    .eq('id', user!.id)
    .single()

  // Get campaign count
  const { count: campaignCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord!.organization_id)

  // Get active campaigns
  const { count: activeCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord!.organization_id)
    .eq('status', 'active')

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to {userRecord?.organization?.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaignCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground mt-2">
              Connect platforms in Settings
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Campaign metrics will appear here once platform integrations are connected.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 5: Test navigation**

Run:
```bash
npm run dev
```

Test:
1. Login and navigate through all pages
2. Verify sidebar highlighting
3. Test user dropdown menu
4. Verify organization name in header

Stop server: Ctrl+C

**Step 6: Commit**

Run:
```bash
git add app/dashboard/ components/dashboard/
git commit -m "feat: add dashboard navigation and layout

- Sidebar with navigation links
- Header with organization name and user menu
- Dashboard homepage with campaign stats
- Active link highlighting
- Sign out functionality

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Next Steps (Not in MVP Scope)

The following features are documented for future implementation:

### Phase 7: Platform API Integrations
- HubSpot adapter implementation
- Google Analytics adapter implementation
- LinkedIn adapter implementation
- Data refresh API routes
- Metric aggregation and storage

### Phase 8: Weekly Summary Automation
- Vercel AI SDK integration with Anthropic Claude
- Weekly summary generation logic
- Vercel Cron job configuration
- Email sending with Resend or similar
- Summary archive and resend

### Phase 9: Advanced Features
- PDF export for quarterly reports
- Sentiment analysis
- AI search tracking
- Event check-in iPad app
- Enhanced attribution reporting

---

## Testing Checklist

Before considering MVP complete, test:

- [ ] User authentication (email, Google, Microsoft OAuth)
- [ ] Organization creation and onboarding
- [ ] User invite and accept flow
- [ ] Campaign CRUD operations
- [ ] UTM parameter generation
- [ ] Platform connection UI (even if no real connections yet)
- [ ] Dashboard navigation
- [ ] Permission checks (admin vs team_member vs client_viewer)
- [ ] RLS policies (users can only see their org data)
- [ ] Sign out functionality

---

## Deployment Instructions

**Step 1: Set up production Supabase project**
1. Create new Supabase project for production
2. Run migration: `supabase/migrations/20260102000001_initial_schema.sql`
3. Configure OAuth providers with production redirect URLs

**Step 2: Set up Vercel project**
1. Connect GitHub repo to Vercel
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
3. Deploy

**Step 3: Bootstrap first user**
1. Manually create first user in Supabase Auth
2. Run SQL to create first admin user in `users` table
3. Create first organization
4. Link user to organization

**Step 4: Verify**
1. Test full auth flow
2. Test organization creation
3. Test invite system
4. Test campaign creation

---

## Plan Complete

This implementation plan provides a complete, step-by-step guide to building the Selo OS MVP. Each task is broken down into small, manageable steps with exact code, commands, and verification steps.

**Total estimated implementation time:** 40-60 hours for experienced Next.js/Supabase developer

**Key omissions from MVP (to be added later):**
- Real platform API integrations (HubSpot, GA, LinkedIn)
- Weekly summary automation with AI
- Email sending
- PDF export
- Sentiment analysis
- Credential encryption (CRITICAL for production!)
