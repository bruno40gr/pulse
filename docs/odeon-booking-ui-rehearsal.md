# Booking-request UI rehearsal

**Parked.** Current work follows staff-assisted phone and walk-in enrollment. The new screen is at `/content-studio-prototype/enrollment`. Request approval remains future work.

## Open

Run the existing development server with `npm run dev` from `/Users/brunowong/pulse`, sign in as an account administrator, and open `/content-studio-prototype/booking-requests`.

This route inherits the existing prototype-area administrator check in `/Users/brunowong/pulse/middleware.ts`. Authentication may still use the existing app infrastructure; the rehearsal itself has no fetches, provider calls, persistence, storage, messages or live bookings. It intentionally does not use the dashboard layout, which has unrelated live reconciliation effects. No middleware, live navigation, or access rules were changed.

## Walkthrough

1. **Avery Lane:** choose an illustrative teacher/time, review the $25-per-lesson terms (fictional $50 base, 50% active-teacher benefit), then simulate approval. Status remains pending payment. Start a simulated payment, choose failure, retry, then choose success. Only success confirms the fictional booking.
2. **Sam Reed:** same-name/different-email example. Approval stays disabled until staff simulate resolving the identity as a separate person, choose a slot, and review terms. No teacher benefit is awarded. This does not merge records or demonstrate a real identity-review system.
3. **Morgan Quinn:** missing-card draft. Simulate card readiness, then submit the booking request to enter staff review. No card numbers or actual provider evidence are accepted.
4. Try declining a request, filtering the queue, and resetting. The student panel previews status copy only; it sends no notification. Refresh resets everything.

All matches use illustrative weekly times rather than dated calendar slots. Choosing a match stands in for student/staff agreement only in this prototype. The fixed USD prices are not saved pricing offers. This is not an actual student-request intake form, scheduling engine, recurrence editor, payment adapter, or provider-verification demonstration.

## Files

- `/Users/brunowong/pulse/app/content-studio-prototype/booking-requests/page.tsx`
- `/Users/brunowong/pulse/app/content-studio-prototype/booking-requests/BookingRequestRehearsal.tsx`
- `/Users/brunowong/pulse/app/content-studio-prototype/booking-requests/booking-requests.module.css`
- `/Users/brunowong/pulse/lib/academy-booking-rehearsal.ts`
- `/Users/brunowong/pulse/scripts/academy/booking-rehearsal.test.cjs`

The rehearsal adapter uses the pure lifecycle contract at `/Users/brunowong/pulse/lib/academy-booking-request.ts`. Caller-controlled UI values are fictional inputs, not authorization, identity matching, card verification or evidence that a real payment succeeded.

## Validation and limits

- `npm run test:academy`: **152 passed**, including seven new rehearsal tests and a React server-render smoke check.
- TypeScript `--noEmit --incremental false`, targeted ESLint and `git diff --check` passed.
- No automated interactive browser or visual verification was performed. Responsive layouts are implemented but need browser review.
- The instructed `node_modules/next/dist/docs/` directory is absent in this installed Next.js package. Existing local App Router prototype and client-component conventions were followed; no new Next.js APIs or dependencies were introduced.

M0/M1 integration gates remain unchanged. This UI does not resolve identity mappings, schema access, scheduling isolation, accepted pricing persistence, financial reconciliation, concurrency or provider authenticity.