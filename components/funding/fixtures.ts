import type { FundingCase, FundingInvoiceStatus, FundingProgram } from './types'

const fixtureCases: Omit<FundingCase, 'invoices'>[] = [
  {
    id: 'case-jayden-kim', student: 'Jayden Kim', parent: 'Hana Ko', fundingOrganization: 'ACE FMS', programType: 'FMS', service: 'Weekly music lessons',
    status: 'needs_review', statusLabel: 'Invoice rejected', owner: 'Vendor', nextStep: 'Review the rejected invoice and confirm the required service code.',
    nextStepOptions: ['Review the rejected invoice and confirm the required service code.', 'Contact the payer for rejection details.', 'Resubmit the corrected invoice.'],
    dueDate: '2026-10-02', amountExpected: 480, amountPaid: 0, outstanding: 480, authorization: 'AUTH-1048', invoiceCadence: 'Monthly',
    submissionRoute: 'Vendor portal', paymentMethod: 'ACH', instructions: 'Submit through the vendor portal and reconcile the deposit against the invoice.', updatedAt: '2026-09-30',
    activity: [
      { id: 'a1', title: 'Invoice marked rejected', detail: 'The September invoice needs review before it can be resubmitted.', date: '2026-09-30' },
      { id: 'a2', title: 'Invoice submitted', detail: 'September services submitted through the vendor portal.', date: '2026-09-22' },
    ],
  },
  {
    id: 'case-carter-white', student: 'Carter White', parent: 'Myndi White', fundingOrganization: 'Alta California Regional Center', programType: 'Regional center', service: 'Private instruction',
    status: 'waiting', statusLabel: 'Waiting on payer', owner: 'Funder', nextStep: 'Check for payment after the stated processing window.',
    nextStepOptions: ['Check for payment after the stated processing window.', 'Ask the coordinator to confirm receipt.', 'No follow-up needed yet.'],
    dueDate: '2026-10-06', amountExpected: 360, amountPaid: 0, outstanding: 360, authorization: 'POS-8821', invoiceCadence: 'Monthly',
    submissionRoute: 'Email receipt', paymentMethod: 'Direct deposit', instructions: 'Send the monthly receipt to the assigned coordinator on the first business day.', updatedAt: '2026-09-29',
    activity: [{ id: 'a3', title: 'Receipt sent', detail: 'September receipt sent to the assigned coordinator.', date: '2026-09-29' }],
  },
  {
    id: 'case-eli-cozen', student: 'Eli Hardy Cozen', parent: 'John Cozen', fundingOrganization: 'CEPS', programType: 'FMS', service: 'Weekly music lessons',
    status: 'active', statusLabel: 'Invoice due soon', owner: 'Vendor', nextStep: 'Prepare next month’s invoice two weeks before service begins.',
    nextStepOptions: ['Prepare next month’s invoice two weeks before service begins.', 'Confirm next month’s authorized amount.', 'Wait until the regular invoice date.'],
    dueDate: '2026-10-16', amountExpected: 520, amountPaid: 520, outstanding: 0, authorization: 'CEPS-2207', invoiceCadence: 'Monthly, in advance',
    submissionRoute: 'Email', paymentMethod: 'Direct deposit', instructions: 'Send the invoice two weeks before each service month.', updatedAt: '2026-09-28',
    activity: [{ id: 'a4', title: 'September paid', detail: 'Payment matched to the September invoice.', date: '2026-09-28' }],
  },
  {
    id: 'case-sam-mirsepassi', student: 'Sam Mirsepassi', parent: 'Nadder Mirsepassi', fundingOrganization: "Mains'l", programType: 'FMS', service: 'Weekly instruction',
    status: 'needs_review', statusLabel: 'Invoice needed', owner: 'Vendor', nextStep: 'Draft the October invoice for family review.',
    nextStepOptions: ['Draft the October invoice for family review.', 'Confirm the family routing contact.', 'Wait until the end of the month.'],
    dueDate: '2026-10-09', amountExpected: 440, amountPaid: 0, outstanding: 440, authorization: 'MSL-7402', invoiceCadence: 'Monthly',
    submissionRoute: 'Family-routed', paymentMethod: 'Direct deposit', instructions: 'Prepare the invoice during the third week of the month; the family completes routing.', updatedAt: '2026-09-27',
    activity: [{ id: 'a5', title: 'Next invoice window opened', detail: 'October billing is ready to prepare.', date: '2026-09-27' }],
  },
  {
    id: 'case-dawson-cassada', student: 'Dawson Cassada', parent: 'Anna & David Cassada', fundingOrganization: 'On My Own', programType: 'FMS', service: 'Music program',
    status: 'waiting', statusLabel: 'Receipt pending', owner: 'Vendor', nextStep: 'Send the receipt after the monthly charge is complete.',
    nextStepOptions: ['Send the receipt after the monthly charge is complete.', 'Confirm the approved monthly cap.', 'Mark the receipt as sent.'],
    dueDate: '2026-10-03', amountExpected: 150, amountPaid: 150, outstanding: 0, authorization: 'Monthly cap: $150', invoiceCadence: 'Monthly, after charge',
    submissionRoute: 'Receipt by email', paymentMethod: 'Card on file', instructions: 'Charge up to the approved monthly amount, then send a receipt to the payer.', updatedAt: '2026-09-26',
    activity: [{ id: 'a6', title: 'September charge completed', detail: 'Receipt still needs to be sent.', date: '2026-09-26' }],
  },
  {
    id: 'case-chaemin-jeon', student: 'Chaemin Jeon', parent: 'Jiyeon Yang', fundingOrganization: 'Public Partnerships', programType: 'FMS', service: 'Private instruction',
    status: 'paid', statusLabel: 'Paid', owner: 'Family', nextStep: 'Confirm whether the family needs a copy of the paid invoice.',
    nextStepOptions: ['Confirm whether the family needs a copy of the paid invoice.', 'No next step.', 'Prepare the next invoice.'],
    dueDate: null, amountExpected: 400, amountPaid: 400, outstanding: 0, authorization: 'PPL-3904', invoiceCadence: 'Monthly',
    submissionRoute: 'Portal manual entry', paymentMethod: 'Direct deposit', instructions: 'Family manages most billing coordination; confirm before changing the routing.', updatedAt: '2026-09-25',
    activity: [{ id: 'a7', title: 'September paid', detail: 'Payment reconciled with no remaining balance.', date: '2026-09-25' }],
  },
  {
    id: 'case-evelyn-wells', student: 'Evelyn Wells', parent: 'Karla Wells', fundingOrganization: 'South Sutter', programType: 'Charter funds', service: 'Music enrichment',
    status: 'active', statusLabel: 'Authorization active', owner: 'Vendor', nextStep: 'Confirm October attendance before preparing the invoice.',
    nextStepOptions: ['Confirm October attendance before preparing the invoice.', 'Prepare the October invoice now.', 'Ask the family to confirm remaining funds.'],
    dueDate: '2026-10-20', amountExpected: 325, amountPaid: 325, outstanding: 0, authorization: 'PO-SS-6118', invoiceCadence: 'Monthly',
    submissionRoute: 'Charter portal', paymentMethod: 'ACH', instructions: 'Use the active purchase order and submit according to the current charter profile.', updatedAt: '2026-09-24',
    activity: [{ id: 'a8', title: 'Purchase order confirmed', detail: 'Current authorization covers October services.', date: '2026-09-24' }],
  },
]

function fixtureInvoiceStatus(item: Omit<FundingCase, 'invoices'>): FundingInvoiceStatus {
  if (item.statusLabel.includes('rejected')) return 'rejected'
  if (item.statusLabel.includes('needed') || item.statusLabel.includes('due soon') || item.statusLabel.includes('Authorization')) return 'draft'
  if (item.status === 'paid' || item.amountPaid === item.amountExpected) return 'paid'
  return 'pending'
}

export const fundingCases: FundingCase[] = fixtureCases.map((item, index) => {
  const status = fixtureInvoiceStatus(item)
  const invoiceNumber = `INV-2026-${String(index + 91).padStart(3, '0')}`
  const changedAt = `${item.updatedAt}T16:00:00.000Z`
  const evidence = status === 'rejected' ? 'Payer response reported that the submitted service code did not match the authorization.' : null
  return {
    ...item,
    invoices: [{
      id: `invoice-${item.id}`,
      invoiceNumber,
      servicePeriodStart: '2026-09-01',
      servicePeriodEnd: '2026-09-30',
      issuedOn: '2026-09-22',
      dueOn: item.dueDate,
      amount: item.amountExpected,
      status,
      paidOn: status === 'paid' ? item.updatedAt : null,
      rejectionEvidence: evidence,
      createdAt: '2026-09-22T16:00:00.000Z',
      updatedAt: changedAt,
      statusEvents: [{
        id: `invoice-event-${item.id}`,
        fromStatus: status === 'draft' ? null : 'pending',
        toStatus: status,
        evidence,
        note: item.activity[0]?.detail || null,
        changedAt,
      }],
    }],
  }
})

export const fundingPrograms: FundingProgram[] = [
  { id: 'ace', name: 'ACE FMS', type: 'FMS', routing: 'Vendor portal', cadence: 'Monthly', activeCases: 1, outstanding: 480, observedPayment: '18–24 days', verification: 'Needs review' },
  { id: 'alta', name: 'Alta California Regional Center', type: 'Regional center', routing: 'Coordinator email', cadence: 'Monthly', activeCases: 1, outstanding: 360, observedPayment: '30–45 days', verification: 'Verified Sep 2026' },
  { id: 'mainsl', name: "Mains'l", type: 'FMS', routing: 'Family-routed', cadence: 'Monthly', activeCases: 1, outstanding: 440, observedPayment: '12–20 days', verification: 'Verified Sep 2026' },
  { id: 'omo', name: 'On My Own', type: 'FMS', routing: 'Card + receipt', cadence: 'Monthly', activeCases: 1, outstanding: 0, observedPayment: 'Immediate charge', verification: 'Needs review' },
  { id: 'ppl', name: 'Public Partnerships', type: 'FMS', routing: 'Portal manual entry', cadence: 'Monthly', activeCases: 1, outstanding: 0, observedPayment: '21–28 days', verification: 'Verified Aug 2026' },
  { id: 'south-sutter', name: 'South Sutter', type: 'Charter funds', routing: 'Charter portal', cadence: 'Monthly', activeCases: 1, outstanding: 0, observedPayment: '25–35 days', verification: 'Profile draft' },
]