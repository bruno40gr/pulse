import StaffView from './StaffView'

export type { StaffMember } from './StaffView'

/** Route module stays prop-free; the view carries the sandbox sample props. */
export default function StaffPage() {
  return <StaffView />
}
