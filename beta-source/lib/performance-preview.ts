export type PerformanceResponse = 'No response' | 'Interested' | 'Declined'
export type Performer = { id: string; response: PerformanceResponse; confirmed?: boolean; piece?: string; minutes?: number }
export type PerformanceMail = { id: string; subject: string; body: string; studentIds: string[]; kind: 'invitation' | 'follow-up' }
export type PerformancePreview = { performers: Performer[]; mail: PerformanceMail[] }

/** Match the sample roster's actual instrument labels, including common player phrasing. */
export function matchesPerformanceSearch(person: { name: string; family: string; email: string; instruments?: string[] }, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/\bdrummers?\b/g, 'drums').replace(/\bdrum\b/g, 'drums')
  const text = normalize([person.name, person.family, person.email, ...(person.instruments || [])].join(' '))
  return normalize(query).split(/\s+/).filter(Boolean).filter(word => !['all', 'students', 'student', 'players', 'player'].includes(word)).every(word => text.includes(word))
}

export function recordPerformanceMail(state: PerformancePreview, mail: PerformanceMail): PerformancePreview {
  const studentIds = [...new Set(mail.studentIds)]
  if (!studentIds.length || state.mail.some(item => item.id === mail.id)) return state
  const performers = [...state.performers]
  if (mail.kind === 'invitation') for (const id of studentIds) {
    if (!performers.some(row => row.id === id)) performers.push({ id, response: 'No response' })
  }
  return { performers, mail: [...state.mail, { ...mail, studentIds }] }
}

export function recordPerformanceResponse(state: PerformancePreview, studentId: string, response: Exclude<PerformanceResponse, 'No response'>): PerformancePreview {
  return { ...state, performers: state.performers.map(row => row.id === studentId ? { ...row, response, confirmed: response === 'Interested' && row.confirmed } : row) }
}

export function confirmPerformer(state: PerformancePreview, id: string, confirmed: boolean): PerformancePreview {
  const row = state.performers.find(item => item.id === id)
  if (!row || row.response !== 'Interested' || !!row.confirmed === confirmed) return state
  const next = { ...row, confirmed }
  // Newly confirmed performers join the end of the running order.
  return { ...state, performers: confirmed ? [...state.performers.filter(item => item.id !== id), next] : state.performers.map(item => item.id === id ? next : item) }
}

export function movePerformer(state: PerformancePreview, id: string, direction: -1 | 1): PerformancePreview {
  const confirmed = state.performers.filter(row => row.confirmed)
  const from = confirmed.findIndex(row => row.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= confirmed.length) return state
  const performers = [...state.performers]
  const a = performers.indexOf(confirmed[from]), b = performers.indexOf(confirmed[to])
  ;[performers[a], performers[b]] = [performers[b], performers[a]]
  return { ...state, performers }
}