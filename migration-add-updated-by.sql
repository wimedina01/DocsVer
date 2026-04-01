-- ============================================================
-- MIGRATION: Add updated_by to airport_requirements
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE airport_requirements
ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT '';
