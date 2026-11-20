'use client'

import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import type { ReactNode } from 'react'

export type ContactDetails = { firstName: string; lastName: string; email: string; phone: string; birthday: string }

/** Shared contact fields for enrollment and adding a person to another entity. */
export function ContactDetailsFields({ value, onChange, disabled = false, errors = {}, children }: {
  value: ContactDetails
  onChange: (field: keyof ContactDetails, value: string) => void
  disabled?: boolean
  errors?: Partial<Record<keyof ContactDetails, string>>
  children?: ReactNode
}) {
  return <FieldGrid>
    <Input label="First name" error={errors.firstName} autoComplete="off" value={value.firstName} disabled={disabled} onChange={event => onChange('firstName', event.target.value)} />
    <Input label="Last name" error={errors.lastName} autoComplete="off" value={value.lastName} disabled={disabled} onChange={event => onChange('lastName', event.target.value)} />
    <Input label="Email" error={errors.email} type="email" autoComplete="off" value={value.email} disabled={disabled} onChange={event => onChange('email', event.target.value)} />
    <Input label="Phone" error={errors.phone} type="tel" autoComplete="off" value={value.phone} disabled={disabled} onChange={event => onChange('phone', event.target.value)} />
    <Input label="Birthday" error={errors.birthday} type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={value.birthday} disabled={disabled} onChange={event => onChange('birthday', event.target.value)} />
    {children}
  </FieldGrid>
}