# Manage subscription — workspace direction

Decision recorded November 4, 2026. Documentation only; this is not an
implementation brief or a commitment to build every capability below.

## Agreed placement and entry

**Manage subscription belongs in the full staff workspace**, not in the Account
quick-view drawer or another modal stacked over it. This is consequential work on
an ongoing agreement, rather than a bounded information lookup.

- Keep Account subscription cards compact and informational, with a three-dot
  menu in the shared card header's actions slot.
- Entry: selected subscription → **⋯ → Manage subscription** → full workspace,
  opened around that subscription's task rather than a generic landing page.
- Preserve account, student and exact subscription identity. Keep program,
  duration, level and status visible so changes cannot be confused with a
  sibling's or another subscription's terms.
- Provide a clear return to the originating Account context.
- Do not add a View schedule shortcut to the cards; the adjacent Schedule tab
  already serves that navigation job.
- This is a staff-management direction. It does not grant equivalent editing
  rights to parents or expand the agreed parent-portal capabilities.

## Potential capabilities — future scope to validate

The supplied Opus Update subscription screenshot is a capability reference, not
a specification to copy as one long form. Group future functionality by job:

| Job | Potential capability |
| --- | --- |
| Manage who pays | Change primary payer; consider a secondary payer and explicit split rules. |
| Manage collection | Configure subscription-level auto-pay and payment reminders. |
| Adjust pricing | Change price, partial-month rate and permitted subscription-specific discounts. |
| Review policies and terms | Show the applied agreement/version and acceptance record; distinguish inherited tuition policy from permitted overrides. |
| Configure invoices | Edit the recurring invoice note; consider supported billing-date, fee and discount overrides. |
| Manage the lifecycle | Consider pause/hold, resume, end and replace as separate, reviewed operations. Coordinate recurring schedule changes with the workspace scheduling flow. |
| Review and communicate changes | Summarize changed terms, effective date, affected invoices and optional client notification before confirmation. |

These are candidates, not implemented features or approved financial rules.
Before implementation, establish permissions, effective-date behavior, impact on
open versus future invoices, policy inheritance, split-payer rules, lifecycle
semantics and notification delivery. Do not infer those rules from Opus controls.

## Interaction boundaries

- Use focused sections and shared workspace components, not the screenshot's
  undifferentiated modal or a separate subscription-specific design system.
- Keep individual lesson moves, absences and cancellations in scheduling. Do not
  confuse cancelling one occurrence with ending the recurring subscription.
- Show inherited policy values explicitly; do not silently duplicate or override
  global settings. Agreement acceptance is a record, not a casual toggle.
- Separate lifecycle operations from ordinary settings saves. Consequential
  changes need a concrete review of effective date and affected items.
- Do not introduce speculative controls or disabled future-action menus now.

## Current prototype versus intended destination

V1's card menu now expands the existing profile panel into a full-screen
Manage subscription workspace. The same SlidePanelHeader, avatar, title sizing,
navigation tabs and panel insets remain in use. The selected subscription summary
and payer form use a bounded 1050px layout, side by side on wider screens and
stacked on mobile. Save payer is a content-sized action in the card header.

Back and successful save return to the originating panel. X returns to the still
mounted contacts table with search and selection preserved. Navigation tabs keep
their V1 behavior and exit the task. The underlying panel portal is reused during
expansion, rather than stacking another modal over it.

This remains a fictional local payer update in V1; it does not enable V2's lifecycle
controls or add the future capabilities listed above. No live permissions,
charges, agreements or notifications change. Parent portal redesign and other
staff workflow shells are outside this pass.

Validation: TypeScript, targeted ESLint, 195 academy/dialog tests, V1 makeup and
V2 browser regressions, plus `scripts/security/subscription-workspace-browser.cjs`
at 1440, 1366, 900 and 390px. The focused browser test compares header/tab computed
styles before and after expansion and verifies compact actions, save/back/X,
no horizontal overflow and retained contacts state. Screenshots are saved to
`/tmp/odeon-subscription-workspace-{1440,1366,900,390}.png`.

Read alongside [Panel JTBD and prototype brief](odeon-panel-jtbd.md) and
[Connected family/account workspace](odeon-student-overview.md).