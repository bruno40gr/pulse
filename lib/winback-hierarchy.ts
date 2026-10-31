type WinbackInquiry = {
  source_form: string
  payload: Record<string, unknown>
  contact?: { full_name: string } | null
}

// Evidence review only. Shared contact destinations and names are never identity links.
export function reviewWinbackHierarchy(lead: WinbackInquiry) {
  if (lead.source_form !== '2026-disenrollment-import') return null
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const student = text(lead.payload.student_name)
  const parent = text(lead.payload.parent_name)
  const contact = text(lead.contact?.full_name)
  const siblings = Array.isArray(lead.payload.siblings) ? lead.payload.siblings : []
  const duplicateStudentRows = siblings.some(row => row && typeof row === 'object' && text(row.name) && text(row.name).toLowerCase() === student.toLowerCase())
  return {
    importedContactLabel: contact,
    recordedStudentName: student,
    recordedParentName: parent,
    needsContactReview: !student || !parent || parent !== contact,
    duplicateStudentRows,
    // Original importer used the student name for the contact label; do not turn
    // that provenance into an authoritative person match or silently save it.
    warning: 'Legacy Win-back import: the contact label may be the former student, not the parent. Confirm the parent and student before correcting this inquiry. Shared email or phone does not prove the relationship.',
  }
}
