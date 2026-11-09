'use client'

import { useEffect, useState } from 'react'
import StudentWorkspace from './StudentWorkspace'
import StudentWorkspaceV2 from './StudentWorkspaceV2'
import StudentWorkspaceV3 from './StudentWorkspaceV3'

/** Explicit opt-in: the original preview remains the default. */
export default function StudentPreview() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => setVersion(new URLSearchParams(window.location.search).get('prototype') || 'v1'), [])
  if (!version) return null
  return version === 'v3' ? <StudentWorkspaceV3 /> : version === 'v2' ? <StudentWorkspaceV2 /> : <StudentWorkspace />
}