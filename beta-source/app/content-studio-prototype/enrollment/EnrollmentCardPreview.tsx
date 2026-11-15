'use client'

import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'

/** Existing synthetic checkout fields, shared by lesson and band enrollment. */
export function EnrollmentCardPreview({ cardholder }: { cardholder: string }) {
  return <div aria-label="Credit card preview"><FieldGrid><Input label="Cardholder name" readOnly value={cardholder} /><Input label="Card number" readOnly value="4242 4242 4242 4242" /><Input label="Expiration" readOnly value="12 / 30" /><Input label="Security code" readOnly value="123" /></FieldGrid></div>
}