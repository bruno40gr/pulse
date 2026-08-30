# Leads CRM Status

Updated: August 28, 2026

## What is built

The new lead capture and microCRM flow is now partially implemented across the Headliner website and the Pulse dashboard.

### Pulse

Built in Pulse:

- CRM intake API at `app/api/intake/route.ts`
- Leads list API at `app/api/leads/route.ts`
- Lead detail API at `app/api/leads/[id]/route.ts`
- Leads dashboard page at `app/dashboard/leads/page.tsx`
- Lead detail page at `app/dashboard/leads/[id]/page.tsx`
- Leads navigation link in `app/dashboard/layout.tsx`
- Separate CRM Supabase admin client at `lib/supabase/crm-admin.ts`

### Headliner website

Built in Headliner:

- Lesson inquiry form can send to CRM
- Tour request form can send to CRM
- Service inquiry form can send to CRM
- Careers form can send to CRM as a job application
- Rollout switch supports three delivery modes

## Delivery modes

The Headliner site now supports an environment-based rollout switch through `VITE_FORM_DELIVERY_MODE`.

### `emailjs`

- Existing EmailJS flow only
- Safest default during active campaigns
- CRM does not receive submissions

### `shadow`

- EmailJS remains the live path
- CRM receives a silent copy
- Best testing mode before cutover

### `crm`

- CRM becomes the only submission path
- EmailJS is bypassed
- Use only after shadow testing is confirmed

## Current UX status

The Leads section is usable now, but still basic.

### Working now

- View lead list
- Filter by status
- Filter by category
- Filter by intake type
- Open individual lead records
- View raw payload data
- View lead event timeline
- Edit status
- Edit priority
- Edit category
- Edit notes
- Edit tags

### Not polished yet

- Search
- Sorting controls
- Bulk actions
- Job applications dashboard UI
- Mobile refinement
- Better visual hierarchy
- Automated email workflows
- Lead conversion into the broader Pulse contact model

## Recommended rollout

1. Keep `VITE_FORM_DELIVERY_MODE=emailjs`
2. When ready, switch to `shadow`
3. Submit real test leads
4. Verify those leads appear in Pulse
5. Only then switch to `crm`

## Why this structure exists

This protects active funnels while allowing CRM development to continue safely.

- `emailjs` protects current campaigns
- `shadow` verifies the new system without risking the live path
- `crm` is the final cutover once confidence is high

## Immediate next improvements

Recommended next steps:

1. Add a job applications dashboard in Pulse
2. Add automated confirmation and internal notification emails
3. Improve lead detail UX and visual polish
4. Add search and sorting to the leads list
5. Prepare production deployment and hosted CRM domain wiring
