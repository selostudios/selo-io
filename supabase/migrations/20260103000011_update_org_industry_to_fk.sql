-- Update organizations table to use industry_id foreign key instead of text

-- Add new industry_id column
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS industry_id UUID;

-- Migrate existing data: match text industry to industries table
UPDATE public.organizations o
SET industry_id = i.id
FROM public.industries i
WHERE o.industry = i.name;

-- For any organizations with industry values that don't match, set to 'Other'
UPDATE public.organizations o
SET industry_id = (SELECT id FROM public.industries WHERE name = 'Other')
WHERE industry_id IS NULL AND industry IS NOT NULL;

-- Drop old industry column
ALTER TABLE public.organizations DROP COLUMN IF EXISTS industry;

-- Rename industry_id to industry
ALTER TABLE public.organizations RENAME COLUMN industry_id TO industry;

-- Add foreign key constraint
ALTER TABLE public.organizations
  ADD CONSTRAINT fk_organizations_industry
  FOREIGN KEY (industry)
  REFERENCES public.industries(id)
  ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_industry ON public.organizations(industry);
