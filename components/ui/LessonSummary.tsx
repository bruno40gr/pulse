import { lessonSummary } from '@/lib/lesson-summary'

/** Shared text content; each workflow retains its own heading and interaction. */
export function LessonSummary(props: Parameters<typeof lessonSummary>[0]) {
  return <span data-lesson-summary="">{lessonSummary(props)}</span>
}
