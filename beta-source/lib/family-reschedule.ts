import type { FamilyPreviewData } from './academy-family-preview'
import { movePreviewLesson, cancelPreviewReplacement, recordPreviewAbsence, type MakeupPreviewState, type PreviewMakeup, type MakeupSlotResolver } from './academy-makeup-preview'
import { detachParticipantOccurrence } from './academy-session'

export type FamilyMoves = Record<string, NonNullable<PreviewMakeup['booking']>>

export function familyLessonSlots(data: FamilyPreviewData, state: MakeupPreviewState, lesson: PreviewMakeup, date: string, resolve: MakeupSlotResolver) {
  return resolve({ ...data, lessons: data.lessons.map(item => item.id === lesson.id ? { ...detachParticipantOccurrence(item), status: 'Cancelled' } : item) },
    { ...state, items: state.items.filter(item => item.id !== lesson.id) }, lesson, date, lesson.program, false)
}

/** Try room combinations against the final schedule, not against draft order. */
export function commitFamilyMovesWithRooms(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, moves: FamilyMoves, resolve: MakeupSlotResolver) {
  const ids = Object.keys(moves)
  const vacantState = { ...state, items: state.items.filter(item => !Object.hasOwn(moves, item.id)) }
  // Keep the origin dates occupied for recurrence expansion, but not for booking checks.
  const cancelledOrigins = data.lessons.filter(item => Object.hasOwn(moves, item.id)).map(item => ({ ...detachParticipantOccurrence(item), status: 'Cancelled' }))
  const cleared = { ...data, lessons: [...data.lessons.filter(item => !Object.hasOwn(moves, item.id)), ...cancelledOrigins] }
  const resolveFinal: MakeupSlotResolver = (snapshot, ...args) => {
    const origin = cancelledOrigins.find(item => item.id === args[1].id)
    return resolve(origin ? { ...snapshot, lessons: [...snapshot.lessons, origin] } : snapshot, ...args)
  }
  const choices = ids.map(id => {
    const booking = moves[id]
    const original = data.lessons.find(item => item.id === id && item.status === 'Scheduled')
    const replacement = state.items.find(item => item.id === id && item.booking)
    const student = data.students.find(item => item.enrollments.some(enrollment => enrollment.id === (replacement?.enrollmentId || original?.enrollmentId)))
    const enrollment = student?.enrollments.find(item => item.id === (replacement?.enrollmentId || original?.enrollmentId))
    if (!student || !enrollment || (!original && !replacement)) throw new Error('Lesson unavailable.')
    const lesson = replacement || { id, lessonId: id, studentId: student.id, enrollmentId: enrollment.id, date: original!.date, duration: enrollment.duration, program: enrollment.program, teacher: original!.teacher || enrollment.teacher, service: enrollment.service }
    return { duration: lesson.duration, slots: resolve(cleared, vacantState, lesson, booking.date, booking.program, false).filter(slot => slot.time === booking.time && slot.teacher === booking.teacher && slot.room) }
  })
  function tryRooms(index: number, assigned: FamilyMoves): ReturnType<typeof commitFamilyMoves> | undefined {
    if (index === ids.length) {
      try { return commitFamilyMoves(data, state, accountId, assigned, resolveFinal) } catch { return undefined }
    }
    for (const option of choices[index].slots) {
      const start = minutes(option.time)
      if (ids.slice(0, index).some((id, i) => {
        const other = assigned[id]
        const from = minutes(other.time)
        return other.date === option.date && (other.teacher === option.teacher || other.room === option.room) && start < from + choices[i].duration && from < start + choices[index].duration
      })) continue
      const result = tryRooms(index + 1, { ...assigned, [ids[index]]: option })
      if (result) return result
    }
  }
  const result = tryRooms(0, {})
  if (!result) throw new Error('These changes don’t fit together. Choose another time or teacher; no lessons were moved.')
  return result
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** Project only explicit changes; selected-but-unchanged lessons stay occupied. */
export function projectFamilyMoves(data: FamilyPreviewData, state: MakeupPreviewState, moves: FamilyMoves) {
  return {
    data: { ...data, lessons: data.lessons.map(item => moves[item.id] ? { ...detachParticipantOccurrence(item), ...moves[item.id], originalDate: item.originalDate || item.date } : item) },
    state: { ...state, items: state.items.map(item => moves[item.id] && item.booking ? { ...item, booking: moves[item.id] } : item) },
  }
}

/** Validate every proposed move against the final arrangement before returning any state. */
export function commitFamilyMoves(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, moves: FamilyMoves, availableSlots?: MakeupSlotResolver) {
  const final = projectFamilyMoves(data, state, moves)
  for (const [id, booking] of Object.entries(moves)) {
    // Retain the original occurrence for ownership, program and past-lesson checks.
    const checkData = { ...final.data, lessons: final.data.lessons.map(item => item.id === id ? data.lessons.find(original => original.id === id)! : item) }
    const checkState = { ...final.state, items: final.state.items.map(item => item.id === id ? state.items.find(original => original.id === id)! : item) }
    movePreviewLesson(checkData, checkState, accountId, id, booking, availableSlots)
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