-- Nutrition Tracker Supabase Tables
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Nutrition Entries (diary)
CREATE TABLE IF NOT EXISTS nutrition_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_iso DATE NOT NULL,
  food_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  amount_grams REAL NOT NULL,
  display_amount TEXT NOT NULL,
  kcal INTEGER NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'parser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ne_user_date ON nutrition_entries(user_id, date_iso);

ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own entries" ON nutrition_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Nutrition Goals
CREATE TABLE IF NOT EXISTS nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal INTEGER NOT NULL DEFAULT 2000,
  protein INTEGER NOT NULL DEFAULT 150,
  carbs INTEGER NOT NULL DEFAULT 250,
  fat INTEGER NOT NULL DEFAULT 65,
  mode TEXT NOT NULL DEFAULT 'maintenance',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own goals" ON nutrition_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Custom Foods
CREATE TABLE IF NOT EXISTS custom_foods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  servings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cf_user ON custom_foods(user_id);

ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own foods" ON custom_foods
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
