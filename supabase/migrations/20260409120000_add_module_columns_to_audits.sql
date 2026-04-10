-- Add module execution tracking columns to audits table
-- These columns support the modular audit plugin architecture by storing
-- per-module timing, status, and error information as JSONB.

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS module_timings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_statuses JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_errors JSONB NOT NULL DEFAULT '{}';

-- Add 'completed_with_errors' status for audits where some modules succeeded
-- but others failed, allowing partial results to be surfaced.
ALTER TYPE unified_audit_status ADD VALUE IF NOT EXISTS 'completed_with_errors' AFTER 'completed';
