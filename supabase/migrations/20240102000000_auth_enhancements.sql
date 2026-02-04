-- Auth Enhancement Migration
-- Adds auth_provider tracking and INSERT policies

-- Add auth_provider column to profiles
ALTER TABLE profiles ADD COLUMN auth_provider TEXT DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google', 'both'));

-- Add has_password flag for quick checks
ALTER TABLE profiles ADD COLUMN has_password BOOLEAN DEFAULT TRUE;

-- INSERT policies for profiles (needed for signup flows)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- INSERT policy for candidate_profiles
CREATE POLICY "Candidates can insert own profile"
  ON candidate_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- INSERT policy for companies
CREATE POLICY "Company owners can insert company"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
