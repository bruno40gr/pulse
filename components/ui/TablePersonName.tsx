'use client'

import type { ReactNode } from 'react'
import { PersonName } from './PersonName'
import { ControlButton } from './ControlButton'

/** One typography rule; action availability never determines parent/detail weight. */
export function TablePersonName({ children, detail = false, onOpen }: { children: ReactNode; detail?: boolean; onOpen?: () => void }) {
  const name = <PersonName weight={detail ? 'normal' : 'semibold'}>{children}</PersonName>
  return <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {onOpen ? <ControlButton kind="name" onClick={onOpen}>{name}</ControlButton> : name}
  </div>
}