-- Migration 005: Import profiles + roster snapshots
-- Run this in the Supabase SQL Editor.

-- Per-tenant import profile: column mapping + active/inactive status vocabulary.
CREATE TABLE IF NOT EXISTS import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  active_statuses TEXT[] NOT NULL DEFAULT ARRAY['active','member'],
  inactive_statuses TEXT[] NOT NULL DEFAULT ARRAY['inactive','cancelled','dropped'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- One row per student per import: was the student active in that snapshot?
CREATE TABLE IF NOT EXISTS roster_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_roster_snapshots_tenant_date ON roster_snapshots(tenant_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_roster_snapshots_student ON roster_snapshots(student_id);
