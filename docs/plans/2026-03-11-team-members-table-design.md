# Team Members Table — Design

## Goal

Replace the single `organization_id` + `role` columns on `users` with a `team_members` join table to cleanly separate identity from membership, enabling future multi-org support.

## Architecture

Gradual migration in two phases. Phase 1 adds the table and dual-writes. Phase 2 (later) drops the old columns. The key trick: updating the `get_user_organization_id()` DB function automatically migrates all 30+ RLS policies without touching them individually.

## New Table Schema

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client_viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);
```

## Phase 1 (Single Deployment)

- Migration: create table, backfill from users, update DB functions, add RLS
- Code: update 3-4 auth helpers to read from team_members, dual-write on invite/team actions
- Result: UI works, old columns still populated, zero downstream changes

## Phase 2 (Later)

- Migration: drop users.organization_id and users.role
- Code: remove dual-writes, clean up UserRecord interface

## Files Changed (Phase 1)

| File                                         | Change                                        |
| -------------------------------------------- | --------------------------------------------- |
| supabase/migrations/new                      | Create table, backfill, update functions, RLS |
| lib/actions/with-auth.ts                     | Join team_members in query, map to UserRecord |
| lib/auth/cached.ts                           | Same join pattern                             |
| lib/auth/settings-auth.tsx                   | Same join pattern                             |
| app/accept-invite/[id]/actions.ts            | Insert team_members + dual-write              |
| app/auth/callback/route.ts                   | Insert team_members + dual-write              |
| app/(authenticated)/settings/team/actions.ts | Delete from team_members + dual-write         |
