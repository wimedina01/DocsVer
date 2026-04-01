import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE CONFIGURATION
// Replace these with your actual Supabase project credentials
// Found at: https://supabase.com/dashboard → Settings → API
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// DATABASE SETUP
// Run the file "database-setup.sql" in your Supabase SQL Editor
// (Dashboard → SQL Editor → + New query → Paste contents → Run)
// ============================================================
