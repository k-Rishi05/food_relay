-- Add wallet_balance column to profiles table
-- Default value is 0 for existing users

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- Add a comment to document the column
COMMENT ON COLUMN profiles.wallet_balance IS 'Current wallet balance in INR (₹) for the user';

-- Create an index for faster balance lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_balance ON profiles(wallet_balance);
