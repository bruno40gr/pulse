# Shared person-table rollout — 2026-11-01

## Scope

- Contacts and Leads use `components/ui/TablePersonViewToggle.tsx` and `components/ui/TablePagination.tsx` with the same Notes sliding switch.
- Contacts retains all roles in Students (flat) and Families (grouped), explicit relationship grouping, independent person selection and a double-click account-holder checkbox shortcut. Search context never becomes an accidental action target.
- Leads presents inquiry/contact and student rows flat or grouped. Only inquiry/contact records have checkboxes; child rows have no selection or inherited blue highlight. Opening any projected student row still opens its inquiry. No synthetic student keys enter action payloads.
- Pagination is ten contacts/groups or ten loaded inquiries. Leads retains the existing server-side Load more behavior; its counter explicitly says loaded inquiries. Page/view changes clear selection. Sorting and search reset the page.
- Selection blue covers the entire row, including group-edge spacing, without coloring unrelated people. Shared column controls, density and membership-scoped column preferences remain intact.
- Notes reuses the extracted switch without changing its hide-done semantics. The design showcase uses the shared person-view switch.
- Fictional review contacts live only in security fixtures and the external loopback harness, never production routes.

## Validation

- `node --test scripts/security/*.test.cjs`: 688 passed, 0 failed.
- TypeScript: `tsc --noEmit` passed.
- Targeted ESLint: no errors; existing unused declarations in Leads and Notes produce warnings.
- Production `npm run build`: passed.
- Contacts rich-list and search-context browser scripts: 1440/900/390px passed, including independent selection, double-click selection, full-edge row coverage, sorting, view changes and pagination.
- Leads table browser script: 1440/900/390px passed, including toolbar geometry, storage fallback, column preferences/density, flat/grouped switching, read-only student rows, search preservation, selection reset, page-local select-all and pagination.
- Browser requests use fictional/intercepted data; no delivery or live mutation claims.
- Installed Next 15.5.22 has no `node_modules/next/dist/docs` directory. No new Next APIs were introduced.

## Deferred

Leads actions and authorization are a separate task. Existing delete permission checks and UI are unchanged; owner-only UI/API enforcement remains outstanding. No new bulk status, notes, follow-up or messaging actions were added. Unrelated entity tables do not receive an inapplicable Students/Families toggle.

## Branch safety

Backup and recovery set: `/Users/brunowong/pulse-backups/table-rollout-20261101-112307`.
An additional bundle copy is under `/Users/brunowong/odeon-private/`.
The recovery drill restored every local and remote branch, applied both worktree patches, extracted untracked/ignored archives (excluding node_modules/.next), and verified archived file hashes.
Only remote branches whose tips are ancestors of main are cleanup candidates. `fix/lead-order-author-only-notes` has an unmerged commit and must remain. The two protected Odeon branches and their dirty integration worktree remain untouched.
