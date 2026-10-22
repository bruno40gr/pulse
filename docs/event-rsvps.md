# Grand Opening RSVPs

This guest list is deliberately separate from CRM contacts, leads, intake capture, and marketing automations.

- Public capture: `POST /api/event-rsvps/public` with `{ name, email, partySize }` and an `Idempotency-Key` header.
- Event and Headliner account are pinned server-side in `lib/event-rsvps.ts`.
- Private list: `GET /api/event-rsvps?tenant=<account UUID>`; requires verified tenant membership and `tenant_settings.manage` (or owner).
- Dashboard: `/dashboard/rsvps`, linked as **Event RSVPs** in Operations.
- Each row is one party; total guests is the sum of party sizes, including submitters. CSV contains the full event list.
- Same submission key and same details returns the original receipt. Reusing a key with different details fails; shared emails are not merged.
- `event_rsvps` and both RPC functions are service-role-only. Guest emails are never exposed through the public endpoint.

## Rollout

1. Apply `supabase/migrations/202610220001_event_rsvps.sql` to the primary Pulse database (not the old CRM database).
2. Deploy Pulse's routes and dashboard.
3. Deploy the website handler pointing to `https://app.headlinerma.com/api/event-rsvps/public`.
4. Verify the authenticated list and counts. Synthetic tests never create production guests.

The website fails closed with a retry message if the dedicated endpoint is unavailable: there is no fallback to lead intake.
No existing CRM records are migrated or deleted automatically. Review any historical `event_rsvp` intake records separately before migrating them.

Public capture currently has input validation and retry protection, but no CAPTCHA. Add abuse controls if automated submissions become a problem.

Run `node --test scripts/security/event-rsvps.test.cjs` for isolated validation, authorization, storage-isolation, CSV, and schema regression tests.