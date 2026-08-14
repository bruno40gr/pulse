import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveInstructor } from '@/lib/instructors'

// Run a single SQL statement via the REST API
async function execSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql })
    if (error) {
      // RPC may not exist — try raw SQL via REST by checking if the table/column exists
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function POST() {
  const results: string[] = []

  try {
    // ── 1. student_accounts table ──
    const { error: saError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS student_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          relationship TEXT,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(student_id, account_id)
        );
      `
    })
    if (saError) {
      results.push(`student_accounts table: ${saError.message}`)
    } else {
      results.push('student_accounts table: created')

      // Seed existing data
      const { error: seedError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          INSERT INTO student_accounts (student_id, account_id, is_primary)
          SELECT id, account_id, true
          FROM students
          WHERE account_id IS NOT NULL
          ON CONFLICT (student_id, account_id) DO NOTHING;
        `
      })
      if (seedError) {
        results.push(`student_accounts seed: ${seedError.message}`)
      } else {
        results.push('student_accounts seed: done')
      }
    }

    // ── 2. staff table ──
    const { error: staffError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    })
    if (staffError) {
      results.push(`staff table: ${staffError.message}`)
    } else {
      results.push('staff table: created')
    }

    // ── 3. instructor_id on enrollments ──
    const { error: instrError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES staff(id);`
    })
    if (instrError) {
      results.push(`enrollments.instructor_id: ${instrError.message}`)
    } else {
      results.push('enrollments.instructor_id: added')
    }

    // ── 4. Backfill instructors (real schema: instructors + instructor_person_id) ──
    // Find all unique instructor names from enrollments.custom_fields
    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from('enrollments')
      .select('id, custom_fields, tenant_id, instructor_person_id')

    if (!enrollError && enrollments) {
      const uniqueInstructors = new Map<string, { tenant_id: string }>()

      for (const e of enrollments) {
        const name = (e.custom_fields as any)?.instructor
        if (name && typeof name === 'string' && name.trim() && name.trim() !== '-') {
          const key = name.trim().toLowerCase()
          if (!uniqueInstructors.has(key)) {
            uniqueInstructors.set(key, { tenant_id: e.tenant_id })
          }
        }
      }

      for (const [name, { tenant_id }] of uniqueInstructors) {
        const resolved = await resolveInstructor(tenant_id, name)
        if (!resolved) continue

        // Update all enrollments with this instructor name
        for (const e of enrollments) {
          const eName = (e.custom_fields as any)?.instructor
          if (eName && eName.trim().toLowerCase() === name && !e.instructor_person_id) {
            await supabaseAdmin
              .from('enrollments')
              .update({ instructor_person_id: resolved.person_id })
              .eq('id', e.id)
          }
        }
      }
      results.push(`instructor backfill: processed ${uniqueInstructors.size} unique instructors`)
    }

    // ── 5. payers table ──
    const { error: payersError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS payers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'other',
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
      `
    })
    if (payersError) {
      results.push(`payers table: ${payersError.message}`)
    } else {
      results.push('payers table: created')
    }

    // ── 6. student_payers table ──
    const { error: spError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    })
    if (spError) {
      results.push(`student_payers table: ${spError.message}`)
    } else {
      results.push('student_payers table: created')
    }

    // ── 7. Indexes ──
    const indexSQLs = [
      `CREATE INDEX IF NOT EXISTS idx_student_accounts_student ON student_accounts(student_id);`,
      `CREATE INDEX IF NOT EXISTS idx_student_accounts_account ON student_accounts(account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);`,
      `CREATE INDEX IF NOT EXISTS idx_staff_person ON staff(person_id);`,
      `CREATE INDEX IF NOT EXISTS idx_enrollments_instructor ON enrollments(instructor_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payers_tenant ON payers(tenant_id);`,
      `CREATE INDEX IF NOT EXISTS idx_student_payers_student ON student_payers(student_id);`,
      `CREATE INDEX IF NOT EXISTS idx_student_payers_payer ON student_payers(payer_id);`,
    ]

    for (const idxSQL of indexSQLs) {
      const { error: idxError } = await supabaseAdmin.rpc('exec_sql', { sql: idxSQL })
      if (idxError) {
        results.push(`index: ${idxError.message}`)
      }
    }
    results.push('indexes: created')

    // ── 8. tenant_settings table ──
    const { error: tsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tenant_settings (
          tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
          logo_url TEXT,
          brand_voice TEXT,
          brand_markdown TEXT,
          highlight_threshold INTEGER NOT NULL DEFAULT 3,
          focus_areas TEXT[] NOT NULL DEFAULT ARRAY['retention', 'billing', 'growth'],
          base_font_size INTEGER NOT NULL DEFAULT 16,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `
    })
    if (tsError) {
      results.push(`tenant_settings table: ${tsError.message}`)
    } else {
      results.push('tenant_settings table: created')
    }

    return NextResponse.json({ message: 'Migration complete', results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, results }, { status: 500 })
  }
}