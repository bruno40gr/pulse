'use client'

import { useState } from 'react'
import { ActionConfirmation } from '@/components/ui/ActionConfirmation'
import type { FamilyAction } from '@/lib/academy-family-preview'

export function familyActionConfirmation(action: FamilyAction, parent = false): string {
  switch (action.kind) {
    case 'reserve-billing-draft':
    case 'release-billing-draft': return ''
    case 'flexible-invoice': return action.arrangement ? 'Invoice issued. Preview billing schedule saved.' : 'Invoice issued.'
    case 'partial-invoice-payment': return 'Preview payment recorded.'
    case 'void-billing-invoice': return 'Preview invoice voided.'
    case 'update-billing-arrangement':
    case 'billing-arrangement-state': return 'Preview billing schedule updated.'
    case 'generate-billing-arrangement': return 'Preview billing run completed. Already covered dates were skipped.'
    case 'pay-invoice': return parent ? 'I’ve paid the invoice.' : 'Payment recorded. Invoice paid.'
    case 'pay-invoices': return parent ? 'I’ve paid the selected invoices.' : 'Payment recorded. Selected invoices paid.'
    case 'refund-invoice': return 'Refund recorded.'
    case 'build-invoice':
    case 'invoice':
    case 'invoice-months': return 'Invoice issued.'
    case 'combine-invoices': return 'Invoice issued.'
    case 'enrollment': return 'Subscription added.'
    case 'delete-enrollment': return 'Subscription deleted.'
    case 'subscription-state': return action.state === 'active' ? 'Subscription resumed.' : action.state === 'frozen' ? 'Subscription frozen.' : 'Subscription cancelled.'
    case 'update-subscription': return 'Subscription updated.'
    case 'payment': return 'Payment details updated.'
    case 'add-card': return parent ? 'I’ve added my credit card.' : 'Credit card added.'
    case 'remove-card': return parent ? 'I’ve removed my credit card.' : 'Credit card removed.'
    case 'default-card': return parent ? 'I’ve updated my default credit card.' : 'Default credit card updated.'
    default: return parent ? 'I’ve saved my changes.' : 'Changes saved.'
  }
}

export function useActionConfirmation() {
  const [message, setMessage] = useState('')
  return { confirm: setMessage, confirmation: message ? <ActionConfirmation message={message} onClose={() => setMessage('')} /> : null }
}