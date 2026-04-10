-- Email suppression list for bounce/complaint handling
-- Checked before every email send to prevent sending to addresses
-- that have hard-bounced or filed complaints.

create table if not exists email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('hard_bounce', 'complaint', 'manual')),
  source text, -- e.g. 'resend_webhook', 'admin'
  source_event_id text, -- Resend event ID for deduplication
  created_at timestamptz not null default now()
);

-- Unique on email+reason so a single address can be suppressed for
-- multiple reasons but not duplicated within the same reason.
create unique index idx_email_suppressions_email_reason
  on email_suppressions (lower(email), reason);

-- Fast lookup by email (case-insensitive) for pre-send check
create index idx_email_suppressions_email
  on email_suppressions (lower(email));

-- Deduplication index for webhook events
create unique index idx_email_suppressions_source_event
  on email_suppressions (source_event_id)
  where source_event_id is not null;

-- RLS: only service role can read/write (no user access needed)
alter table email_suppressions enable row level security;

-- No RLS policies = service_role only access (which is what we want)
