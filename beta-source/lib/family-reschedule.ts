import type { FamilyPreviewData } from './academy-family-preview'
import { movePreviewLesson, cancelPreviewReplacement, recordPreviewAbsence, type MakeupPreviewState, type PreviewMakeup } from './academy-makeup-preview'

export type FamilyMoves = Record<string, NonNullable<PreviewMakeup['booking']>>

/** Project only explicit changes; selected-but-unchanged lessons stay occupied. */
export function projectFamilyMoves(data: FamilyPreviewData, state: MakeupPreviewState, moves: FamilyMoves) {
  return {
    data: { ...data, lessons: data.lessons.map(item => moves[item.id] ? { ...item, ...moves[item.id], originalDate: item.originalDate || item.date } : item) },
    state: { ...state, items: state.items.map(item => moves[item.id] && item.booking ? { ...item, booking: moves[item.id] } : item) },
  }
}

/** Validate every proposed move against the final arrangement before returning any state. */
export function commitFamilyMoves(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, moves: FamilyMoves) {
  const final = projectFamilyMoves(data, state, moves)
  for (const [id, booking] of Object.entries(moves)) {
    // Retain the original occurrence for ownership, program and past-lesson checks.
    const checkData = { ...final.data, lessons: final.data.lessons.map(item => item.id === id ? data.lessons.find(original => original.id === id)! : item) }
    const checkState = { ...final.state, items: final.state.items.map(item => item.id === id ? state.items.find(original => original.id === id)! : item) }
    movePreviewLesson(checkData, checkState, accountId, id, booking)
  }
  return final
}

/** Immutable staging: an invalid item prevents the entire cancellation batch. */
export function cancelFamilyLessons(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, ids: string[], parent = false) {
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Choose lessons to cancel.')
  let next = { data, state }
  for (const id of ids) {
    next = next.state.items.some(item => item.id === id && item.booking)
      ? { data: next.data, state: cancelPreviewReplacement(next.data, next.state, accountId, id) }
      : recordPreviewAbsence(next.data, next.state, accountId, id, false, parent)
  }
  return next
}