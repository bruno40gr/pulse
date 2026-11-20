# Component reuse and collaboration directives

These rules apply to prototypes and production work. Read alongside `AGENTS.md` and `docs/ui-layout-rules.md`. A prototype is not permission to replace established UI or make unapproved UX decisions.

## Decision ownership

- The user leads all UX decisions: layout, navigation, wording, visual design, action placement and interaction patterns. Follow agreed direction. Identify gaps and ask about material UX choices instead of inventing solutions.
- The agent leads backend and performance work: implementation, data structures, reliability and optimization, within the agreed scope.
- Always inform the user when making backend or performance decisions and explain their implications in concise, plain language. Do not silently make trade-offs.
- Bring technical choices that affect UX, scope, cost or data behavior to the user before proceeding. Technical ownership does not authorize UX changes.
- Distinguish proposed decisions from implemented changes. Do not present assumptions as agreements.

## Reuse the actual experience

- Adding a person to an event, band or other entity follows `docs/adding-people-convention.md`: stacked existing/new radios and the shared five-field contact form.

- Inspect the existing implementation and its callers before changing it. Identify the actual workspace, table, selection toolbar, row menu, creation form and detail panel relevant to the task.
- Reuse complete compositions and behavior, not just low-level components. Library buttons and fields inside a custom replacement do not establish fidelity to the existing experience.
- Preserve the established table columns, cell rendering, family hierarchy, filters, preferences, navigation and detail-panel behavior unless the user approves a specific change.
- Preserve the established selection action bar, including its blue presentation where used, selection count, clear action, placement and responsive behavior. Do not replace it with buttons in a search or filter row.
- Add actions through existing row menus, bulk-action surfaces and header slots. Do not scatter standalone buttons or introduce permanent panel actions without UX approval.
- Do not add preview-specific column, header or layout overrides merely to approximate the existing UI. Do not copy an existing form into a parallel implementation and call it reuse.
- Source and relationship are distinct. Do not invent provenance, badges or columns to fill perceived gaps.

## Simulate data, not replacement UI

- Beta's existing sample directory owns its fictional contacts, families and
  students. Reuse those stable IDs and relationships; do not import a prototype's
  separate people, inquiry or membership fixtures as runtime defaults. Keep tiny
  test fixtures explicitly injected and distinguish them from product sample data.
- Keep fictional data and local-only operations behind adapters, callbacks or providers while retaining the actual UI composition.
- Operational API coupling is a refactoring concern, not permission to build a lookalike. Prefer extracting a shared composition with operational and simulated adapters.
- Preserve production defaults, permissions, validation, conditional visibility, draft retention and submitted values when extracting shared UI.
- Keep simulations isolated from operational reads and writes, invitations, charges and bookings unless explicitly authorized.
- If actual reuse has a genuine blocker, explain the blocker, options and implications. Obtain explicit approval before substituting UI or reducing fidelity. Do not claim complexity without inspecting the implementation.

## Prototype content and communication

- Never add descriptive or explanatory text, prototype disclaimers, implementation notes or jargon inside the prototype experience unless the user explicitly requests them.
- Keep technical explanations, safety limitations and simulation details in the conversation or documentation, not the UI.
- Use concise, plain-language labels. Do not add helper text merely to explain how the prototype works.
- Preserve existing product copy unless a change is approved. Do not treat this rule as permission to remove established validation, error or confirmation messages.
- Keep conversation updates concise. Explain decisions and meaningful implications without overexplaining or adding jargon.

## Verification and reporting

- Follow `docs/integration-principles.md` when promoting prototype changes. The
  goal is an improved shared experience, not frozen old visuals or wholesale
  replacement of newer implementations.
- Before implementation, identify the reference experience and the behaviors that must remain unchanged.
- Check visual fidelity separately from functional correctness. Inspect desktop and mobile screenshots against the reference, including unselected and selected states, the bulk-action bar, row menus, forms and detail panels as applicable.
- Run relevant behavior tests and available type/lint checks. Verify account and sibling isolation when shared people or bulk operations are involved.
- Passing tests, matching labels or importing an existing component does not prove UI parity or constitute UX approval.
- Describe reuse accurately: unchanged component reuse, extracted shared composition, primitive reuse or custom implementation. Disclose deviations and remaining gaps; do not claim preservation when preview overrides change the experience.
- Keep corrections scoped and preserve unrelated uncommitted work. Verify all edited or created files before reporting completion.
