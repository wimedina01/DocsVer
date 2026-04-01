-- ============================================================
-- HR DOCUMENT CHECKLIST - SUPABASE DATABASE SETUP
-- ============================================================
-- Run this ENTIRE script in Supabase SQL Editor:
--   Dashboard → SQL Editor → + New query → Paste → Run
--
-- If you get errors, try running each section separately
-- (copy one section at a time between the divider lines)
-- ============================================================


-- ============================================================
-- SECTION 1: DROP EXISTING TABLES (safe reset if re-running)
-- Remove this section if you want to KEEP existing data
-- ============================================================
DROP POLICY IF EXISTS "Allow all on checklist_transactions" ON checklist_transactions;
DROP POLICY IF EXISTS "Allow all on default_requirements" ON default_requirements;
DROP POLICY IF EXISTS "Allow all on airport_requirements" ON airport_requirements;
DROP POLICY IF EXISTS "Allow all on requirements_matrix" ON requirements_matrix;

DROP TABLE IF EXISTS checklist_transactions CASCADE;
DROP TABLE IF EXISTS default_requirements CASCADE;
DROP TABLE IF EXISTS airport_requirements CASCADE;
DROP TABLE IF EXISTS requirements_matrix CASCADE;


-- ============================================================
-- SECTION 2: CREATE TABLES
-- ============================================================

-- Table 1: Master list of document requirements
CREATE TABLE requirements_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  description TEXT,
  applies_to TEXT DEFAULT 'ALL',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table 2: Airport-specific requirement overrides
CREATE TABLE airport_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES requirements_matrix(id) ON DELETE CASCADE,
  airport_code VARCHAR(3) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT airport_req_unique UNIQUE(requirement_id, airport_code),
  CONSTRAINT airport_req_status_check CHECK (status IN ('Required', 'Required - Copies OK', 'Not Required'))
);

-- Table 3: Default requirements (fallback when destination not in matrix)
CREATE TABLE default_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES requirements_matrix(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT default_req_unique UNIQUE(requirement_id),
  CONSTRAINT default_req_status_check CHECK (status IN ('Required', 'Required - Copies OK', 'Not Required'))
);

-- Table 4: Transaction history (stores every completed checklist)
CREATE TABLE checklist_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  awb_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  routing TEXT,
  flight_numbers TEXT,
  shipment_type TEXT NOT NULL,
  remains_type TEXT NOT NULL,
  checklist_items JSONB NOT NULL,
  all_verified BOOLEAN DEFAULT false,
  employee_id TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT tx_shipment_check CHECK (shipment_type IN ('Origin', 'Transit')),
  CONSTRAINT tx_remains_check CHECK (remains_type IN ('Human Remains', 'Human Remains - ASH'))
);


-- ============================================================
-- SECTION 3: CREATE INDEXES
-- ============================================================
CREATE INDEX idx_airport_req_code ON airport_requirements(airport_code);
CREATE INDEX idx_airport_req_id ON airport_requirements(requirement_id);
CREATE INDEX idx_tx_awb ON checklist_transactions(awb_number);
CREATE INDEX idx_tx_date ON checklist_transactions(submitted_at);
CREATE INDEX idx_req_active ON requirements_matrix(is_active, sort_order);


-- ============================================================
-- SECTION 4: SEED DATA - Document Requirements
-- ============================================================
INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Airway Bill (AWB)', 'Original Air Waybill', 'BOTH', 1);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Death Certificate', 'Certified Death Certificate', 'HUMAN_REMAINS', 2);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Cremation Certificate', 'Certificate of Cremation', 'HUMAN_REMAINS_ASH', 3);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Burial/Transit Permit', 'Burial or Transit Permit issued by local authority', 'BOTH', 4);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Embalming Certificate', 'Certificate confirming embalming has been completed', 'HUMAN_REMAINS', 5);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Consular/Embassy Letter', 'Authorization from destination country consulate or embassy', 'BOTH', 6);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Shipper Declaration', 'Declaration by the shipper regarding the contents', 'BOTH', 7);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Funeral Home Letter', 'Letter from licensed funeral home', 'BOTH', 8);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Hermetically Sealed Certificate', 'Certificate that casket is hermetically sealed', 'HUMAN_REMAINS', 9);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Health Department Clearance', 'Clearance from health department', 'HUMAN_REMAINS', 10);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('NON-CONTAGIOUS Disease Statement', 'Statement that deceased did not die of contagious disease', 'HUMAN_REMAINS', 11);

INSERT INTO requirements_matrix (document_name, description, applies_to, sort_order) VALUES
  ('Passport Copy of Deceased', 'Copy of the passport of the deceased', 'BOTH', 12);


-- ============================================================
-- SECTION 5: SEED DATA - Default Requirements
-- (Sets all active requirements to "Required" by default)
-- ============================================================
INSERT INTO default_requirements (requirement_id, status)
SELECT id, 'Required'
FROM requirements_matrix
WHERE is_active = true;


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE requirements_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Allow anonymous read/write access
-- (The anon key from your Supabase project settings uses the "anon" role)
CREATE POLICY "anon_all_requirements_matrix"
  ON requirements_matrix
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_airport_requirements"
  ON airport_requirements
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_default_requirements"
  ON default_requirements
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_checklist_transactions"
  ON checklist_transactions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- DONE! You should see "Success. No rows returned."
--
-- Verify by going to Table Editor:
--   requirements_matrix    → should have 12 rows
--   default_requirements   → should have 12 rows
--   airport_requirements   → should have 0 rows (add via Admin page)
--   checklist_transactions → should have 0 rows (populated when checklists are completed)
-- ============================================================
