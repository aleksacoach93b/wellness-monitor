-- Session Types & Match Day feature
-- Run this in the Supabase SQL editor BEFORE deploying the new code.
-- Safe to run multiple times (uses IF NOT EXISTS).

-- 1) Coach-managed tag lists (Session Types + Match Day)
CREATE TABLE IF NOT EXISTS tags (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  "order"     integer NOT NULL DEFAULT 0,
  "isActive"  boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tags_category_idx ON tags (category);

-- 2) Snapshot labels on each response (text, not FK, so renaming/deleting a tag never breaks history)
ALTER TABLE responses ADD COLUMN IF NOT EXISTS "sessionType" text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS "matchDay" text;

-- 3) Per-survey opt-in toggles
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS "trackSessionType" boolean NOT NULL DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS "trackMatchDay" boolean NOT NULL DEFAULT false;

-- 4) (Optional) seed a few starter tags you can edit/delete later in /admin/session-types
INSERT INTO tags (id, name, category, "order", "isActive")
VALUES
  ('seed_session_gym',   'Gym',   'SESSION', 0, true),
  ('seed_session_pitch', 'Pitch', 'SESSION', 1, true),
  ('seed_session_rehab', 'Rehab', 'SESSION', 2, true)
ON CONFLICT (id) DO NOTHING;
