-- Drop standalone AIO tables (replaced by unified audit modules)
DROP TABLE IF EXISTS aio_ai_analyses CASCADE;
DROP TABLE IF EXISTS aio_checks CASCADE;
DROP TABLE IF EXISTS aio_audits CASCADE;

-- Drop AIO-related types if they exist
DROP TYPE IF EXISTS aio_audit_status CASCADE;
