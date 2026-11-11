# Work-area navigation

Implemented variant A from the navigation study: one work-area switcher and a
contextual vertical sidebar. Production routes derive the selected area from the
URL; tenant-scoped session storage remembers only authorized links in each area.
Unread lead/conversation counts, the Conversations home action, identity,
notifications, logout and server-side authorization remain in place.

## Areas

- Operations: Overview, Notes, Leads, Contacts, Communications, Campaigns, Event RSVPs.
- School Setup: Teachers & staff (the existing staff directory). Other proposed
  School Setup editors are not on this branch; no dead links or placeholder editors
  are introduced. The protected Odeon integration worktree is unchanged.
- Funding: Funded students and Funding programs (existing routes).
- Website: All content, Events, Deadlines, Announcements, Articles, Community posts.
  Community posts retains its independent existing curation workflow. Website
  publishing destinations remain administrator-only.
- Settings: Account settings, Integrations, Brand, Roles, Permissions. Links follow
  existing account capabilities. Legacy `?tab=` links redirect to section URLs,
  preserving other query parameters. No new Billing or Security screen is implied.

## Website editing

The connected editor no longer renders the content-type picker cards. Type-specific
routes filter the shared record list and expose a matching Create action. All
content is the aggregate list. Existing record cards, upload controls, save/publish
commands and publish confirmation are retained.

An editor recovery copy is stored per tenant/content view in session storage.
Unsaved edits prompt before ordinary link navigation or tab closure. Returning to
the same view restores the editor. Recovery is best-effort if browser storage is
unavailable; it is not a server save or publication. Browser Back does not use the
link-click prompt, but the recovery copy remains available. The editor's Back
action still saves before returning to its list.

## Validation

- TypeScript: `npx tsc --noEmit --incremental false` passes.
- Targeted lint: no errors; three pre-existing Brand image warnings remain in the
  moved Settings client.
- Focused navigation/settings/conversation/content/API suite: 59/59 passes.
- Full security suite: 794/797. The three failures reproduce in a clean archive
  of committed HEAD: one Undo-copy assertion and two Contacts contextual-toolbar
  source assertions. No unrelated Contacts behavior was changed.
- Intercepted browser review at 1440px and 390px: filtered views, card-picker
  removal, create, dirty-navigation cancel/accept, recovery, save, aggregate list,
  vertical Settings, area memory, cross-area search, nested Escape behavior,
  legacy Settings redirects, and overflow checks pass.
- Browser tests run against an isolated loopback host, without production
  middleware or live APIs. Not evidence of a production deployment.

Repeat the browser workflow using `scripts/security/work-area-navigation-browser.cjs`
with `WORK_AREA_REVIEW_URL` pointing at an isolated loopback host exposing the real
dashboard layout/routes, `PLAYWRIGHT_MODULE` pointing to the installed Playwright
module, and optionally `WORK_AREA_BROWSER_CHANNEL=chrome`.