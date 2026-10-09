import type { ComponentPropsWithRef } from 'react'

/**
 * Native button boundary shared by action, navigation, and icon controls.
 * Deliberately supplies no defaults: type, styling, handlers, refs, ARIA,
 * and disabled behavior remain exactly as supplied by the caller.
 * Use Button for standard visual variants.
 */
export function ButtonBase(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} />
}