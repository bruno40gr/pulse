<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI conventions

- Reuse existing UI components and design tokens. Place card-level action buttons in the card header's top-right actions slot (for example, `DenseSectionPanel.actions`), not below scrolling content.
- Keep conversation channel toggles in the conversation surface header's top-right corner using `ControlButton` with `kind="toggle"` and `aria-pressed`, consistently across list and contact views.
