-- Add 'analyzing' to the unified_audit_status enum
ALTER TYPE unified_audit_status ADD VALUE IF NOT EXISTS 'analyzing' AFTER 'checking';
