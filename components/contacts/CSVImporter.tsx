'use client'
import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { getActiveTenantId } from '@/lib/tenant'

interface CSVImporterProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

interface Mapping {
  csv_column: string
  field_key: string
  field_label: string
  field_type: string
  is_core: boolean
  confidence: string
}

export default function CSVImporter({ isOpen, onClose, onImportComplete }: CSVImporterProps) {
  const [step, setStep] = useState<'choose' | 'upload' | 'confirm' | 'importing' | 'done'>('choose')
  const [files, setFiles] = useState<File[]>([])
  const [csvTexts, setCsvTexts] = useState<string[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [inferring, setInferring] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)
  const [error, setError] = useState('')
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [isFirstImport, setIsFirstImport] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const resetAll = () => {
    setStep('choose')
    setFiles([])
    setCsvTexts([])
    setMappings([])
    setInferring(false)
    setResult(null)
    setError('')
    setIncluded({})
    setIsFirstImport(true)
    setEditingKey(null)
    setEditingLabel('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    resetAll()
    onClose()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    if (selected.length === 0) return
    setFiles(selected)
    setError('')
    setInferring(true)
    setStep('upload')
    try {
      const texts: string[] = []
      const allHeaders: string[] = []
      const sampleRows: any[] = []

      for (const file of selected) {
        const text = await file.text()
        texts.push(text)
        const parsed = Papa.parse<any>(text, { header: true, preview: 4, skipEmptyLines: true })
        const headers = parsed.meta.fields || []
        const rows = parsed.data
        allHeaders.push(...headers)
        // Only send the first 3 sample rows, first 20 columns, cells truncated to 100 chars
        const trimmedRows = rows.slice(0, 3).map((row: any) => {
          const trimmed: Record<string, string> = {}
          Object.keys(row)
            .slice(0, 20)
            .forEach((key) => {
              const value = row[key]
              const sanitized = value == null
                ? ''
                : String(value)
                    .slice(0, 100)
                    .replace(/"/g, "'")
                    .replace(/[\n\r]/g, ' ')
                    .replace(/[\x00-\x1F\x7F]/g, '')
              trimmed[key] = sanitized
            })
          return trimmed
        })
        sampleRows.push(...trimmedRows)
      }

      const res = await fetch('/api/infer-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: allHeaders, sample_rows: sampleRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to infer fields')

      const inferred: Mapping[] = data.mappings || []
      setCsvTexts(texts)

      // Fetch existing tenant fields and compare against inferred field_keys
      const fieldsRes = await fetch(`/api/tenant-fields?tenant=${getActiveTenantId()}`)
      const existingFields = await fieldsRes.json()
      const existingKeys = new Set((existingFields || []).map((f: any) => f.field_key))
      const newFields = inferred.filter((m: Mapping) => !existingKeys.has(m.field_key))
      const hasExisting = (existingFields || []).length > 0

      if (hasExisting && newFields.length === 0) {
        // No new fields — skip confirm and go straight to importing
        setMappings(inferred)
        setIncluded(Object.fromEntries(inferred.map((m: Mapping) => [m.field_key, true])))
        setIsFirstImport(false)
        await runImport([], texts)
      } else if (hasExisting && newFields.length > 0) {
        // Existing fields found but new ones detected — show only the new fields
        setMappings(newFields)
        setIncluded(Object.fromEntries(newFields.map((m: Mapping) => [m.field_key, true])))
        setIsFirstImport(false)
        setStep('confirm')
      } else {
        // First import ever (no existing tenant fields) — show all inferred fields
        setMappings(inferred)
        setIncluded(Object.fromEntries(inferred.map((m: Mapping) => [m.field_key, true])))
        setIsFirstImport(true)
        setStep('confirm')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setInferring(false)
    }
  }

  const updateLabel = (key: string, label: string) => {
    setMappings(prev => prev.map(m => (m.field_key === key ? { ...m, field_label: label } : m)))
  }

  const runImport = async (fieldsToSave: Mapping[], textsToImport: string[]) => {
    setStep('importing')
    setError('')
    try {
      // Save included custom fields to tenant_fields
      const customFields = fieldsToSave
        .filter(m => !m.is_core && included[m.field_key])
        .map((m, idx) => ({
          field_key: m.field_key,
          field_label: m.field_label,
          field_type: m.field_type,
          sort_order: idx,
        }))

      if (customFields.length > 0) {
        const fieldsRes = await fetch(`/api/tenant-fields?tenant=${getActiveTenantId()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customFields),
        })
        if (!fieldsRes.ok) {
          const err = await fieldsRes.json()
          throw new Error(err.error || 'Failed to save fields')
        }
      }

      // Import each CSV
      let created = 0
      let updated = 0
      for (const csv of textsToImport) {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Import failed')
        created += data.created ?? 0
        updated += data.updated ?? 0
      }

      setResult({ created, updated })
      setStep('done')
    } catch (e) {
      setError((e as Error).message)
      setStep('confirm')
    }
  }

  const handleConfirm = () => {
    runImport(mappings, csvTexts)
  }

  const handleDone = () => {
    resetAll()
    onImportComplete()
    onClose()
  }

  const startEdit = (mapping: Mapping) => {
    setEditingKey(mapping.field_key)
    setEditingLabel(mapping.field_label)
  }

  const commitEdit = () => {
    if (editingKey) updateLabel(editingKey, editingLabel.trim() || editingLabel)
    setEditingKey(null)
    setEditingLabel('')
  }

  const buildSubheading = () => {
    const instructorField = mappings.find(m => /instructor|teacher|staff/.test(m.field_key))
    const dayField = mappings.find(m => /day|schedule/.test(m.field_key))
    const instructorLabel = instructorField?.field_label
    const dayLabel = dayField?.field_label

    let example = ''
    if (instructorLabel && dayLabel) {
      example = `, like all of ${instructorLabel}'s students or everyone with a lesson on ${dayLabel}`
    } else if (instructorLabel) {
      example = `, like all of ${instructorLabel}'s students`
    } else if (dayLabel) {
      example = `, everyone with a lesson on ${dayLabel}`
    }

    if (!isFirstImport) {
      return 'Your spreadsheet tells us these fields are important to your business. These can always be updated later.'
    }

    return `Your spreadsheet tells us these fields are important to your business. You can send targeted messages to exactly the right people${example}. These can always be updated later.`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '640px', borderRadius: '16px', zIndex: 50, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #E8E8E4', position: 'sticky', top: 0, background: 'white' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A1A', margin: 0, fontFamily: 'sans-serif' }}>
            {step === 'choose' && 'Import Contacts'}
            {step === 'upload' && 'Import contacts'}
            {step === 'confirm' && (isFirstImport ? "Here's how your business looks to us so far." : "Your file has some information we haven't seen before.")}
            {step === 'importing' && 'Importing'}
            {step === 'done' && 'Import complete'}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#6B6B6B', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {step === 'choose' && (
            <div style={{ padding: '8px 4px' }}>
              <p style={{ fontSize: '14px', color: '#6B6B6B', marginBottom: '28px' }}>
                How would you like to bring in your contacts?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => setStep('upload')}
                  style={{
                    background: 'white', border: '1px solid #E8E8E4', borderRadius: '12px',
                    padding: '24px', textAlign: 'left', cursor: 'pointer',
                    transition: 'border-color 0.15s', fontFamily: 'sans-serif',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8392B')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E8E8E4')}
                >
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>📊</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A', marginBottom: '6px' }}>Upload a spreadsheet</div>
                  <div style={{ fontSize: '13px', color: '#6B6B6B', lineHeight: 1.5 }}>CSV or Excel file from your existing system</div>
                </button>
                <button
                  style={{
                    background: '#FAFAF9', border: '1px solid #E8E8E4', borderRadius: '12px',
                    padding: '24px', textAlign: 'left', cursor: 'not-allowed', opacity: 0.6,
                    fontFamily: 'sans-serif', position: 'relative',
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔌</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A', marginBottom: '6px' }}>Connect your system</div>
                  <div style={{ fontSize: '13px', color: '#6B6B6B', lineHeight: 1.5 }}>Mindbody, Jackrabbit, and more</div>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#F0F0EC', color: '#6B6B6B', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>Coming soon</div>
                </button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <label style={{ display: 'block', border: '1px dashed #E8E8E4', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF9' }}>
                <span style={{ color: '#6B6B6B', fontSize: '14px', fontFamily: 'sans-serif' }}>
                  {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Click to choose CSV files'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              {files.length > 0 && !inferring && (
                <div style={{ marginTop: '16px' }}>
                  {files.map((file) => (
                    <div key={file.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #E8E8E4', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', color: '#1A1A1A', fontFamily: 'sans-serif' }}>
                      <span>{file.name}</span>
                      <span style={{ color: '#6B6B6B', fontSize: '12px' }}>{file.size.toLocaleString()} bytes</span>
                    </div>
                  ))}
                </div>
              )}

              {inferring && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#C8392B', animation: 'pulse 1s infinite' }} />
                  <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '16px 0 0', fontFamily: 'sans-serif' }}>Reading your spreadsheet...</p>
                </div>
              )}

              {error && (
                <p style={{ color: '#DC2626', fontSize: '13px', margin: '16px 0 0', fontFamily: 'sans-serif' }}>{error}</p>
              )}
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6, fontFamily: 'sans-serif' }}>
                {buildSubheading()}
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6B6B6B', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Your column</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Hey, Cohen reads</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600, textAlign: 'center' }}>Include</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.field_key} style={{ borderBottom: '1px solid #F5F5F4', color: '#1A1A1A' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {mapping.confidence === 'low' && (
                            <span title="Low confidence" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                          )}
                          <span>{mapping.csv_column}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingKey === mapping.field_key ? (
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={e => setEditingLabel(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') setEditingKey(null)
                            }}
                            autoFocus
                            style={{
                              padding: '6px 8px',
                              border: '1px solid #C8392B',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'sans-serif',
                              outline: 'none',
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(mapping)}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed #D4D4D4', paddingBottom: '1px' }}
                            title="Click to edit"
                          >
                            {mapping.field_label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {mapping.is_core ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F1EF', color: '#6B6B6B', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, fontFamily: 'sans-serif' }}>
                            🔒 Core
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={included[mapping.field_key] ?? true}
                            onChange={e => setIncluded(prev => ({ ...prev, [mapping.field_key]: e.target.checked }))}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {error && (
                <p style={{ color: '#DC2626', fontSize: '13px', margin: '16px 0 0', fontFamily: 'sans-serif' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => setStep('upload')}
                  style={{
                    padding: '12px 24px',
                    background: 'white',
                    color: '#6B6B6B',
                    border: '1px solid #E8E8E4',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'sans-serif',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#C8392B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'sans-serif',
                  }}
                >
                  Confirm and import
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#C8392B', animation: 'pulse 1s infinite' }} />
              <p style={{ color: '#1A1A1A', fontSize: '15px', fontWeight: 500, margin: '16px 0 0', fontFamily: 'sans-serif' }}>Importing your contacts...</p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                ✓
              </div>
              <p style={{ color: '#1A1A1A', fontSize: '16px', fontWeight: 600, margin: '0 0 8px', fontFamily: 'sans-serif' }}>
                Done. {result?.created ?? 0} contacts added, {result?.updated ?? 0} updated.
              </p>
              <button
                onClick={handleDone}
                style={{
                  marginTop: '24px',
                  padding: '12px 32px',
                  background: '#C8392B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }`}</style>
    </div>
  )
}