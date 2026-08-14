-- Migration 001: Student Accounts, Staff, and Payers
-- Run this in the Supabase SQL Editor or via the migrate API

-- ============================================================
-- 1. STUDENT ACCOUNTS (multiple account holders per student)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  relationship TEXT,              -- 'Mother', 'Father', 'Guardian', etc.
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, account_id)
);

-- Seed existing data: migrate students.account_id into student_accounts
INSERT INTO student_accounts (student_id, account_id, is_primary)
SELECT id, account_id, true
FROM students
WHERE account_id IS NOT NULL
ON CONFLICT (student_id, account_id) DO NOTHING;

-- ============================================================
-- 2. STAFF (instructors as first-class entities)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'instructor',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, person_id)
);

-- Add instructor_id to enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES staff(id);

-- Backfill: for each unique instructor name in enrollments.custom_fields,
-- find or create a person + staff record, then set instructor_id.
-- This is best done via application code (see migrate API route).

-- ============================================================
-- 3. PAYERS (funding organizations — schema only, for future use)
-- ============================================================
CREATE TABLE IF NOT EXISTS payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',   -- 'charter_school', 'gov_program', 'foundation', 'other'
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  program_name TEXT,
  funding_terms TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
  coverage_percent INTEGER DEFAULT 100,
  coverage_cap NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, payer_id)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_student_accounts_student ON student_accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_accounts_account ON student_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_person ON staff(person_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_instructor ON enrollments(instructor_id);
CREATE INDEX IF NOT EXISTS idx_payers_tenant ON payers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_payers_student ON student_payers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payers_payer ON student_payers(payer_id);