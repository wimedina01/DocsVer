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
// DATABASE SETUP SQL - Run this in your Supabase SQL Editor
// (Dashboard → SQL Editor → New query)
// ============================================================
/*

-- ===========================================
-- TABLE 1: Requirements Matrix
-- Rows = document requirements
-- Columns = ICAO airport codes with statuses
-- ===========================================
CREATE TABLE IF NOT EXISTS requirements_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  description TEXT,
  applies_to TEXT DEFAULT 'ALL',  -- 'ALL', 'HUMAN_REMAINS', 'HUMAN_REMAINS_ASH', 'BOTH'
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Airport-specific requirement overrides
-- If a destination is not in this table, the "default" requirements apply
CREATE TABLE IF NOT EXISTS airport_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID REFERENCES requirements_matrix(id) ON DELETE CASCADE,
  airport_code CHAR(3) NOT NULL,  -- 3-letter ICAO code
  status TEXT NOT NULL CHECK (status IN ('Required', 'Required - Copies OK', 'Not Required')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requirement_id, airport_code)
);

-- Default requirements (used when destination is NOT in the matrix)
CREATE TABLE IF NOT EXISTS default_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID REFERENCES requirements_matrix(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Required', 'Required - Copies OK', 'Not Required')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requirement_id)
);

-- ===========================================
-- TABLE 2: Transaction History
-- Stores every completed checklist
-- ===========================================
CREATE TABLE IF NOT EXISTS checklist_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  awb_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  routing TEXT,
  flight_numbers TEXT,
  shipment_type TEXT NOT NULL CHECK (shipment_type IN ('Origin', 'Transit')),
  remains_type TEXT NOT NULL CHECK (remains_type IN ('Human Remains', 'Human Remains - ASH')),
  checklist_items JSONB NOT NULL,  -- Array of {requirement, status, verification}
  all_verified BOOLEAN DEFAULT false,
  employee_id TEXT,  -- V or U number
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- INDEXES for performance
-- ===========================================
CREATE INDEX idx_airport_requirements_code ON airport_requirements(airport_code);
CREATE INDEX idx_airport_requirements_req ON airport_requirements(requirement_id);
CREATE INDEX idx_transactions_awb ON checklist_transactions(awb_number);
CREATE INDEX idx_transactions_date ON checklist_transactions(submitted_at);
CREATE INDEX idx_requirements_active ON requirements_matrix(is_active, sort_order);

-- ===========================================
-- SEED DATA: Common HR document requirements
-- ===========================================
INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Airway Bill (AWB)', 'Original Air Waybill', 'BOTH', 1),
  ('Death Certificate', 'Certified Death Certificate', 'HUMAN_REMAINS', 2),
  ('Cremation Certificate', 'Certificate of Cremation', 'HUMAN_REMAINS_ASH', 2),
  ('Burial/Transit Permit', 'Burial or Transit Permit issued by local authority', 'BOTH', 3),
  ('Embalming Certificate', 'Certificate confirming embalming has been completed', 'HUMAN_REMAINS', 4),
  ('Consular/Embassy Letter', 'Authorization from destination country consulate or embassy', 'BOTH', 5),
  ('Shipper Declaration', 'Declaration by the shipper regarding the contents', 'BOTH', 6),
  ('Funeral Home Letter', 'Letter from licensed funeral home', 'BOTH', 7),
  ('Hermetically Sealed Certificate', 'Certificate that casket is hermetically sealed', 'HUMAN_REMAINS', 8),
  ('Health Department Clearance', 'Clearance from health department', 'HUMAN_REMAINS', 9),
  ('NON-CONTAGIOUS Disease Statement', 'Statement that deceased did not die of contagious disease', 'HUMAN_REMAINS', 10),
  ('Passport Copy of Deceased', 'Copy of the passport of the deceased', 'BOTH', 11);

-- Insert default requirements (standard checklist)
INSERT INTO default_requirements (requirement_id, status)
SELECT id, 'Required' FROM requirements_matrix WHERE is_active = true;

-- ===========================================
-- ROW LEVEL SECURITY (optional but recommended)
-- ===========================================
ALTER TABLE requirements_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (tighten later with auth)
CREATE POLICY "Allow all on requirements_matrix" ON requirements_matrix FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on airport_requirements" ON airport_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on default_requirements" ON default_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on checklist_transactions" ON checklist_transactions FOR ALL USING (true) WITH CHECK (true);

*/
