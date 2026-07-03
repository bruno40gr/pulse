/*
  ═══════════════════════════════════════════════════════════════════════════
  ODEON DESIGN SYSTEM — Headliner Music Academy Internal Admin Tool
  ═══════════════════════════════════════════════════════════════════════════

  A standalone design system for ODEON, built from the approved Headliner
  color token set. Tokens are remapped to semantic roles appropriate for a
  dense, staff-facing admin tool — not a marketing/conversion surface.

  Unlike the public HeadlinerDesignSystem.jsx, crimson is NOT restricted to
  CTAs only. Teal is NOT restricted to wayfinding. All tokens are assigned to
  whichever semantic role makes the most sense for admin UI density.

  ── DEPENDENCIES ───────────────────────────────────────────────────────────
  - React
  - lucide-react (for Button, Modal icons)

  ── USAGE ──────────────────────────────────────────────────────────────────
  import { C, fonts, googleFontsUrl, ODEON } from "./ODEONDesignSystem";
  <style>{globalStyles}</style>
  ═══════════════════════════════════════════════════════════════════════════
*/

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Raw color tokens — direct from HeadlinerDesignSystem.jsx, plus green.
 * Use ODEON semantic roles (below) in components instead of these directly.
 */
export const C = {
  // ── Base ────────────────────────────────────────────────────────────────
  espresso:      "#1A130F",
  espressoMd:    "#251A14",
  espressoLt:    "#2F2118",
  cream:         "#FAF6F0",
  lightCream:    "#FAF6EB",
  offWhite:      "#F2EDE6",
  offwhite:      "#FAF9F7",
  white:         "#FFFFFF",
  muted:         "#7A6860",
  text:          "#2C1F18",

  // ── Brand accents ───────────────────────────────────────────────────────
  crimson:       "#FF0044",
  crimsonHover:  "#CC0036",
  teal:          "#00A8C8",
  tealDark:      "#006E84",
  tealPastel:    "#C8F0F8",
  yellow:        "#FFDA00",
  yellowDark:    "#7A5F00",
  yellowPastel:  "#FFF7CC",
  yellowHover:   "#FFC800",
  blush:         "#FFD6CC",
  blushDark:     "#8B2D1A",

  // ── Success (new, not in original HeadlinerDesignSystem.jsx) ─────────────
  green:         "#3D8B5F",
  greenDark:     "#1F5C3A",
  greenPastel:   "#DCF0E4",

  // ── UI / form ───────────────────────────────────────────────────────────
  border:        "#E8E2DA",
  inputBg:       "#FAFAF8",
  placeholder:   "#BBBBBB",
  subtext:       "#AAAAAA",
  errorText:     "#DC2626",
  errorBg:       "#FEF2F2",
  errorBorder:   "#FECACA",

  // ── White alpha (for dark backgrounds) ──────────────────────────────────
  white07: "rgba(255,255,255,0.07)",
  white08: "rgba(255,255,255,0.08)",
  white10: "rgba(255,255,255,0.10)",
  white15: "rgba(255,255,255,0.15)",
  white18: "rgba(255,255,255,0.18)",
  white20: "rgba(255,255,255,0.20)",
  white25: "rgba(255,255,255,0.25)",
  white28: "rgba(255,255,255,0.28)",
  white30: "rgba(255,255,255,0.30)",
  white38: "rgba(255,255,255,0.38)",
  white45: "rgba(255,255,255,0.45)",
  white55: "rgba(255,255,255,0.55)",
  white60: "rgba(255,255,255,0.60)",
  white70: "rgba(255,255,255,0.70)",
  white80: "rgba(255,255,255,0.80)",

  // ── Espresso alpha ──────────────────────────────────────────────────────
  espresso06: "rgba(26,19,15,0.06)",
  espresso10: "rgba(26,19,15,0.10)",
  espresso75: "rgba(26,19,15,0.75)",

  // ── Black alpha ─────────────────────────────────────────────────────────
  black20: "rgba(0,0,0,0.20)",

  // ── Crimson alpha ───────────────────────────────────────────────────────
  crimson06: "rgba(255,0,68,0.06)",
  crimson08: "rgba(255,0,68,0.08)",
  crimson15: "rgba(255,0,68,0.15)",
  crimson30: "rgba(255,0,68,0.30)",

  // ── Teal alpha ──────────────────────────────────────────────────────────
  teal06: "rgba(0,168,200,0.06)",
  teal08: "rgba(0,168,200,0.08)",
  teal15: "rgba(0,168,200,0.16)",
  teal30: "rgba(0,168,200,0.30)",

  // ── Yellow alpha ────────────────────────────────────────────────────────
  yellow05: "rgba(255,218,0,0.05)",
  yellow12: "rgba(255,218,0,0.12)",
  yellow50: "rgba(255,218,0,0.50)",

  // ── Green alpha ─────────────────────────────────────────────────────────
  green06: "rgba(61,139,95,0.06)",
  green15: "rgba(61,139,95,0.15)",
  green30: "rgba(61,139,95,0.30)",
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEMANTIC ROLES — use these in components instead of raw C.* tokens
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ODEON semantic color mappings. These are the tokens you should use in UI
 * components so that the color intent is clear.
 */
export const ODEON = {
  // Actions
  primary:         C.crimson,
  primaryHover:    C.crimsonHover,
  secondary:       C.teal,
  secondaryHover:  "#0096B4",
  secondaryDark:   C.tealDark,

  // Status
  success:         C.green,
  successLight:    C.greenPastel,
  successDark:     C.greenDark,
  warning:         C.yellow,
  warningLight:    C.yellowPastel,
  warningDark:     C.yellowDark,
  error:           C.errorText,
  errorLight:      C.errorBg,
  errorBorder:     C.errorBorder,
  info:            C.tealPastel,
  infoDark:        C.tealDark,

  // Surfaces
  sidebar:         C.espresso,
  sidebarHover:    C.espressoMd,
  sidebarActive:   C.espressoLt,
  sidebarText:     C.white55,
  sidebarTextActive: C.white,
  bg:              C.cream,
  surface:         C.white,
  card:            C.white,
  inputBg:         C.inputBg,
  offWhite:        C.offWhite,

  // Text
  textPrimary:     C.text,
  textSecondary:   C.muted,
  textMuted:       C.subtext,
  textOnDark:      C.white,
  textOnDarkMuted: C.white70,

  // Borders
  border:          C.border,
  borderLight:     C.cream,
  borderFocus:     C.crimson,
  borderSecondary: C.teal,

  // Highlights
  highlight:       C.crimson15,
  highlightSecondary: C.teal15,
  highlightSuccess: C.green15,
  highlightWarning: C.yellow12,
};

/* ═══════════════════════════════════════════════════════════════════════════
   FONT FAMILIES
   ═══════════════════════════════════════════════════════════════════════════ */

export const fonts = {
  display: "'Baloo 2', sans-serif",
  body:    "'DM Sans', sans-serif",
};

export const googleFontsUrl =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&display=swap";

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

export const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  ::selection { background: ${C.crimson15}; color: ${C.espresso}; }
  html, body { overflow-x: hidden; max-width: 100vw; }
  * { min-width: 0; box-sizing: border-box; }

  body {
    color: ${C.text};
    background-color: ${C.cream};
    font-family: ${fonts.body};
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

  /* Input focus ring */
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: ${C.crimson};
  }
`;