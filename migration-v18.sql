-- ============================================================
-- MIGRATION: Add supervisor override and review tracking
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS supervisor_id TEXT DEFAULT '';
ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS supervisor_notes TEXT DEFAULT '';
ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS supervisor_reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS override_by TEXT DEFAULT '';
ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS override_notes TEXT DEFAULT '';
ALTER TABLE checklist_transactions ADD COLUMN IF NOT EXISTS override_at TIMESTAMP WITH TIME ZONE;

-- Add cause_of_death_pending flag to airport_requirements
ALTER TABLE airport_requirements ADD COLUMN IF NOT EXISTS cause_of_death_pending_ok BOOLEAN DEFAULT false;
