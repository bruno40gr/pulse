# Interaction colors and control ownership

## Norm

### Focus styling decision — November 25, 2026

The owner explicitly reaffirmed the previously shipped no-focus-ring convention.
`app/globals.css` suppresses outlines and box-shadow rings on `*:focus` and
`*:focus-visible`. This supersedes the visible-outline guidance below. Retain
keyboard navigation, tab order, native control behavior and dialog focus handling;
do not disable focus or blur elements to implement this visual decision. The
focus token remains available, but must not reintroduce global focus rings.

The source of truth is `interaction` in `lib/tokens.ts`. `lib/interaction-theme.ts`
publishes those values as CSS custom properties on the root layout. Beta reuses
the same roles, not a second palette.

| Role | Use |
| --- | --- |
| `selected` / `--interaction-selected` | Electric teal `#00BEDF`: checked checkbox/radio, enabled switch, selected day/pill, progress, selected tab indicator, table contextual bar |
| `selectedSurface` | Pale teal `#E6F9FC` for selected cards, options and view controls |
| `selectedText` | Deep teal `#00677A` on selected pale surfaces |
| `onSelected` | Espresso on a filled electric-teal control; do not use white text on this bright fill |
| `focus` | Deep-teal `#00677A` keyboard-focus outline, 2px with 3px offset; system Highlight in forced colors |
| `off` | Neutral gray for an off switch; disabled controls also retain their disabled semantics and opacity |
| `primary` | Espresso primary action, not a selected checkbox or radio |

Electric teal is the ordinary interaction accent. Crimson and the older brand
teal tokens remain available for brand/illustrative uses, not local overrides. Error/success/warning treatments
describe outcomes. Completed task controls may therefore remain green; wizard
progress is not a success notification and uses electric teal. Do not replace meaningful
calendar service-type colors, avatar colors, sticky notes or image swatches
with a single interaction accent.

The bright fill is intentionally distinct from the deeper text/focus shade.
Keep existing blue link/info roles and semantic error colors independent; do not
recolor status notices or legacy brand accents as part of this interaction change.

## Component ownership

### Scheduling surfaces and student identity

- Lesson setup/summary cards and the active rescheduling sidebar use neutral
  surfaces and borders. Do not add active/editing badges or pseudo-element copy.
- Available times use the same neutral dashed treatment in enrollment, makeup
  booking and rescheduling. Clickability alone does not justify a teal fill.
- Student time blocks use `calendarStudentPalette` from `lib/tokens.ts` and
  `calendarStudentStyle` from `lib/calendar-appearance.ts`: muted violet, indigo,
  plum and slate, not status red/yellow/green or interaction teal. Use the stable
  family roster, never the active lesson index, to assign the color.
- Original and proposed time retain the student's identity color. Stronger
  borders distinguish the active/selected block, without new indicators.
- Keep shared checkbox, switch, tab and keyboard-focus colors teal. Calendar
  identity does not override keyboard focus, status notices or global links.

- Use `Checkbox` for labelled choices and `CheckboxInput` for named table
  controls. The latter preserves refs for the native indeterminate state.
- Use `RadioOptionGroup`, `Switch`, `ToggleSwitch`, `WeekdayToggleGroup`, `Pill`,
  `Tabs`, `ModalStepper` and `ProgressStepper` rather than page-built lookalikes.
- Use `Input`, `Select`, `Textarea`, `SearchSelect` and `Button` for ordinary
  fields/actions. SearchSelect inherits Input focus: no extra inset ring.
- Canonical components live in `components/ui`. Reconciled Beta controls
  re-export these implementations. Do not resume editing parallel copies.
- Legacy native controls inherit the root accent/focus roles. Any explicit
  `accentColor` or `accent-color` must use `interaction.selected` or
  `var(--interaction-selected)`. No local blue/black/teal literals.
- Native date/time popup internals are browser/OS-owned. The application owns
  the surrounding field, label and focus; it does not promise identical popup
  styling on every browser. Do not implement a custom picker for color alone.

## Audit disposition

### Fixed in this pass

- Shared checkbox, radio, switches (both APIs), weekdays, pills, color-swatch
  selection, tabs, both steppers, table checkbox primitive and contextual bar.
- Beta duplicates of Checkbox, Switch, ControlButton, Input, Select, Textarea,
  SearchSelect, ModalStepper, ProgressStepper, Tabs, Pill, Button, ButtonBase
  and Disclosure now delegate to the canonical components.
- The enrollment self/student and deferred-payment checkboxes, duration/cadence,
  trial-discount and payer fields now use library controls rather than raw JSX.
- Local enrollment selection styles (teacher/view buttons, selected student,
  slot, replacement, teacher edit and booking popover) now use interaction roles.
- School Setup option accents, progress fill and image selection use roles;
  legacy enrollment, calendar-booking, Contacts, access and Settings accents
  were normalized. All explicit native-control accents across app/components
  and Beta equivalents are covered by an automated source audit.
- Focus colors are shared, including BackControl and the native fallback;
  removed the duplicate SearchSelect inset and radio-row focus rings.

### Intentionally retained / follow-up inventory

- Native date/time/file controls retain browser UI.
- School Setup and the original standalone enrollment prototype still have
  native controls and local structural CSS. Their accents are normalized; they
  are not all fully migrated component compositions.
- Calendar slot grids retain specialized custom layout/controls and categorical
  block colors. This pass normalizes the selection styles it touches, not every
  calendar rendering implementation.
- Other CSS still contains hard-coded borders, neutral surfaces and domain
  colors. This is not a claim of a repository-wide zero-literal migration.
- Badge/NotificationCard/status palettes, avatars and note colors remain outside
  the generic selection contract; older Beta status implementations still exist.
- Explicit legacy `Button variant="teal"` and inverse/sidebar navigation are
  retained for compatibility. New ordinary CTAs use primary/secondary; don't
  introduce another form accent through that legacy variant.

## Reference and validation

`/dashboard/design` contains `InteractionShowcase`: real, interactive components
including checked/off/disabled/mixed states, radio choices, weekdays, both
steppers, segmented views, search, validation, and native date/time fields.

- `scripts/security/interaction-colors.test.cjs`: role wiring, Beta delegation,
  checkbox ref/event semantics, selection roles, and repository native-accent audit.
- `scripts/security/interaction-colors-browser.cjs`: desktop/mobile computed
  colors, keyboard controls, search selection, focus and forced-colors checks.
  It targets `/interaction-review` on the isolated local review host; that host
  renders the same InteractionShowcase without production dashboard coupling.
- Re-run existing layout, calendar and workflow-completion browser regressions
  when changing these primitives. Color changes must not alter submitted values,
  draft continuity, validation or record ownership.