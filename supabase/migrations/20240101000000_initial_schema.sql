-- Initial Database Schema for TechFill
-- This migration creates the core tables for the platform

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- PROFILES TABLE (extends auth.users)
-- ================================================
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'company', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ================================================
-- CANDIDATE PROFILES TABLE
-- ================================================
CREATE TABLE candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT,
  headline TEXT,
  seniority TEXT CHECK (seniority IN ('junior', 'mid', 'senior', 'lead', 'principal')),
  tech_stack TEXT[] DEFAULT '{}',
  employment_preference TEXT,
  remote_preference TEXT CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')),
  cv_url TEXT,
  is_visible BOOLEAN DEFAULT FALSE,
  completeness_score INT DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for candidate profiles
CREATE INDEX idx_candidate_visible ON candidate_profiles(is_visible) WHERE is_visible = TRUE;
CREATE INDEX idx_candidate_tech_stack ON candidate_profiles USING GIN(tech_stack);
CREATE INDEX idx_candidate_seniority ON candidate_profiles(seniority);
CREATE INDEX idx_candidate_location ON candidate_profiles(location);

-- Enable Row Level Security
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidate profiles
CREATE POLICY "Candidates can view own profile"
  ON candidate_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Candidates can update own profile"
  ON candidate_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Companies can view visible candidate profiles"
  ON candidate_profiles FOR SELECT
  USING (
    is_visible = TRUE
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'company'
    )
  );

-- ================================================
-- COMPANIES TABLE
-- ================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  team_size TEXT CHECK (team_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  location TEXT,
  website TEXT,
  logo_url TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_user_id)
);

-- Indexes for companies
CREATE INDEX idx_companies_owner ON companies(owner_user_id);
CREATE INDEX idx_companies_approved ON companies(is_approved) WHERE is_approved = TRUE;

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Company owners can view own company"
  ON companies FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Company owners can update own company"
  ON companies FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Anyone can view approved companies"
  ON companies FOR SELECT
  USING (is_approved = TRUE);

-- ================================================
-- JOBS TABLE
-- ================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  seniority TEXT CHECK (seniority IN ('junior', 'mid', 'senior', 'lead', 'principal')),
  tech_stack TEXT[] DEFAULT '{}',
  location TEXT,
  is_remote BOOLEAN DEFAULT FALSE,
  salary_min INTEGER,
  salary_max INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for jobs
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_tech_stack ON jobs USING GIN(tech_stack);
CREATE INDEX idx_jobs_seniority ON jobs(seniority);
CREATE INDEX idx_jobs_remote ON jobs(is_remote) WHERE is_remote = TRUE;

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Company owners can manage their jobs"
  ON jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = jobs.company_id
      AND companies.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active jobs"
  ON jobs FOR SELECT
  USING (status = 'active');

-- ================================================
-- APPLICATIONS TABLE
-- ================================================
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'applied' CHECK (
    status IN ('applied', 'reviewed', 'interview', 'rejected', 'hired', 'withdrawn')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- Indexes for applications
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Enable Row Level Security
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for applications
CREATE POLICY "Candidates can view own applications"
  ON applications FOR SELECT
  USING (auth.uid() = candidate_id);

CREATE POLICY "Candidates can create applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "Candidates can withdraw applications"
  ON applications FOR UPDATE
  USING (auth.uid() = candidate_id AND status = 'applied')
  WITH CHECK (status = 'withdrawn');

CREATE POLICY "Companies can view applications for their jobs"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN companies ON companies.id = jobs.company_id
      WHERE jobs.id = applications.job_id
      AND companies.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can update application status"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN companies ON companies.id = jobs.company_id
      WHERE jobs.id = applications.job_id
      AND companies.owner_user_id = auth.uid()
    )
  );

-- ================================================
-- FUNCTIONS AND TRIGGERS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidate_profiles_updated_at
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- STORAGE BUCKETS
-- ================================================

-- Create storage buckets (run these in Supabase Dashboard or via SQL Editor)
-- These need to be created via Supabase Storage interface or API

-- Bucket for CVs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket for company logos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for CVs
CREATE POLICY "Candidates can upload their own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Candidates can update their own CV"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Candidates and companies can view CVs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs'
    AND (
      -- Candidate can view own CV
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Company can view if they have an application from this candidate
      EXISTS (
        SELECT 1 FROM applications
        JOIN jobs ON jobs.id = applications.job_id
        JOIN companies ON companies.id = jobs.company_id
        WHERE companies.owner_user_id = auth.uid()
        AND applications.candidate_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Storage policies for company logos
CREATE POLICY "Companies can upload their own logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM companies
      WHERE companies.owner_user_id = auth.uid()
      AND companies.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');
