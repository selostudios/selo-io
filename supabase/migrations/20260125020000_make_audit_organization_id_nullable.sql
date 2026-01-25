-- Allow null organization_id for one-time audits
ALTER TABLE site_audits ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE performance_audits ALTER COLUMN organization_id DROP NOT NULL;
