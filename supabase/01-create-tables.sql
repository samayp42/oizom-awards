-- Oizom Awards Night Database Schema
-- Run this script in Supabase SQL Editor

-- Create categories table
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  nominees JSONB NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create votes table with device fingerprinting
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES categories(id),
  option TEXT NOT NULL CHECK (option IN ('A', 'B', 'C', 'D')),
  device_id TEXT NOT NULL,
  browser_fingerprint TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, device_id)
);

-- Create indexes for performance
CREATE INDEX idx_votes_category ON votes(category_id);
CREATE INDEX idx_votes_device ON votes(device_id);
CREATE INDEX idx_votes_browser_fp ON votes(browser_fingerprint);
CREATE INDEX idx_categories_unlocked ON categories(unlocked);

-- Ensure only one category can be unlocked at a time
CREATE UNIQUE INDEX idx_single_unlocked ON categories(unlocked) WHERE unlocked = true;
