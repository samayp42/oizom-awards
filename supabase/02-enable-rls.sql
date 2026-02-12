-- Enable Row Level Security (RLS)
-- Run this script in Supabase SQL Editor after creating tables

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view categories
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

-- RLS Policy: Anyone can view votes (for counting)
CREATE POLICY "Anyone can view votes"
  ON votes FOR SELECT
  USING (true);

-- RLS Policy: Anyone can insert votes (duplicate prevention via UNIQUE constraint)
CREATE POLICY "Anyone can insert votes"
  ON votes FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Anyone can update categories (for admin unlock)
-- In production, you'd add admin authentication here
CREATE POLICY "Anyone can update categories"
  ON categories FOR UPDATE
  USING (true);
