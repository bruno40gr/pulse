# Table toolbars

- Use shared `Button variant="secondary" size="toolbar"` for peer toolbar actions, including column-picker triggers. Do not hand-style a native summary to resemble a button.
- Use shared `Select controlSize="toolbar"` for compact toolbar filters. This uses the same sizing, border, typography and radius as toolbar buttons. Do not override it with legacy input styles.
- Align controls centrally with `spacing.sm` gaps and allow wrapping on narrow screens. Keep the display-options trigger at the right edge.
- Toggle state uses `aria-pressed` and a check indicator; disclosure state uses `aria-expanded` and `aria-controls`. Escape closes the picker and restores trigger focus; outside clicks and tabbing out dismiss it.
- The columns picker contains only the column choices and row-spacing control. Do not add saved-preference helper copy or a reset action.
- Preferences remain browser-local and membership-scoped. Toolbar interactions must not add polling or per-column requests.
- The live component example is the **Table toolbar** section in `/dashboard/design`.