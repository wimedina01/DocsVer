-- ============================================================
-- MIGRATION: Add custom_note column to airport_requirements
-- ============================================================
-- Run this in Supabase SQL Editor if you already have the
-- database set up. If starting fresh, use database-setup.sql
-- which already includes this column.
-- ============================================================

ALTER TABLE airport_requirements
ADD COLUMN IF NOT EXISTS custom_note TEXT DEFAULT '';
