-- Create industries table
CREATE TABLE IF NOT EXISTS public.industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read industries
CREATE POLICY "Anyone can view industries"
  ON public.industries FOR SELECT
  TO authenticated
  USING (true);

-- Seed initial industries
INSERT INTO public.industries (name) VALUES
  ('Marketing'),
  ('Advertising'),
  ('Public Relations'),
  ('Software'),
  ('Technology'),
  ('SaaS'),
  ('E-commerce'),
  ('Retail'),
  ('Healthcare'),
  ('Finance'),
  ('Accounting'),
  ('Consulting'),
  ('Education'),
  ('Real Estate'),
  ('Manufacturing'),
  ('Construction'),
  ('Hospitality'),
  ('Food & Beverage'),
  ('Non-Profit'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- Grant access
GRANT SELECT ON public.industries TO authenticated;
