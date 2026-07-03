/*
  ═══════════════════════════════════════════════════════════════════════════
  HEADLINER DESIGN SYSTEM — Portable Single-File Export
  ═══════════════════════════════════════════════════════════════════════════

  This file is a self-contained design system for Headliner Music Academy.
  It bundles color tokens, font families, program-level color rules, and all
  reusable UI components into one drop-in module.

  ── USAGE ──────────────────────────────────────────────────────────────────

  1. Install dependencies in your project:
     npm install react lucide-react

  2. Copy this file into your project (e.g., src/HeadlinerDesignSystem.jsx)

  3. Load the fonts (add to your HTML <head> or CSS @import):
     <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&display=swap" rel="stylesheet">

  4. Import what you need:
     import {
       C, fonts, programPalettes, googleFontsUrl, globalStyles,
       Button, Modal, Eyebrow, Chip, Bubble, WaveDivider, TextBlock,
       FormField, Input, Select, Textarea, PillToggle,
       CTASection, FAQList, StatsGrid, Card,
     } from "./HeadlinerDesignSystem";

  5. Drop globalStyles into a <style> tag:
     <style>{globalStyles}</style>

  ── DEPENDENCIES ───────────────────────────────────────────────────────────

  - React (useState, useEffect, useRef)
  - lucide-react (X, ArrowRight, ChevronDown icons)

  ── COLOR RULES ────────────────────────────────────────────────────────────

  Crimson (#FF0044) is always reserved for CTAs — never use it as a
  background or decorative color on early childhood pages.

  When building any program page, reference programPalettes[programName]
  to decide which colors should dominate the layout, which are accents,
  and what percentage of the page each color should occupy.

  ═══════════════════════════════════════════════════════════════════════════
*/

import { useState, useEffect, useRef } from "react";
import { X, ArrowRight, ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Headliner color palette.
 * All components reference these tokens — never hardcode hex values.
 *
 * @example
 * import { C } from "./HeadlinerDesignSystem";
 * <div style={{ background: C.espresso, color: C.white }} />
 */
export const C = {
  // ── Base ────────────────────────────────────────────────────────────────
  espresso:      "#1A130F",  // Primary dark — hero backgrounds, dark panels
  espressoMd:    "#251A14",  // Mid espresso — subtle dark surfaces
  espressoLt:    "#2F2118",  // Light espresso — hover states on dark
  cream:         "#FAF6F0",  // Page base — light sections, content panels
  lightCream:    "#FAF6EB",  // Slightly warmer cream — card backgrounds
  offWhite:      "#F2EDE6",  // Neutral off-white — image placeholders
  offwhite:      "#FAF9F7",  // Hover background (camelCase alias)
  white:         "#FFFFFF",  // Pure white — cards, inputs on focus
  muted:         "#7A6860",  // Secondary text — descriptions, labels
  text:          "#2C1F18",  // Body text on light backgrounds

  // ── Brand accents ───────────────────────────────────────────────────────
  crimson:       "#FF0044",  // CTA buttons, links, key highlights
  crimsonHover:  "#CC0036",  // Crimson hover state
  teal:          "#00A8C8",  // Wayfinding, labels, secondary accents
  tealDark:      "#006E84",  // Teal text on light backgrounds
  tealPastel:    "#C8F0F8",  // Soft teal — decorative fills, bubbles
  yellow:        "#FFDA00",  // Energy pops, summer camp, playful accents
  yellowDark:    "#7A5F00",  // Yellow text on light backgrounds
  yellowPastel:  "#FFF7CC",  // Soft yellow — decorative fills
  yellowHover:   "#FFC800",  // Yellow hover state
  blush:         "#FFD6CC",  // Early childhood — Music & Me, warm fills
  blushDark:     "#8B2D1A",  // Blush text on light backgrounds

  // ── UI / form ───────────────────────────────────────────────────────────
  border:        "#E8E2DA",  // Input borders, card borders, dividers
  inputBg:       "#FAFAF8",  // Input background (unfocused)
  placeholder:   "#BBBBBB",  // Input placeholder text
  subtext:       "#AAAAAA",  // Hints, secondary captions
  errorText:     "#DC2626",  // Error messages
  errorBg:       "#FEF2F2",  // Error background
  errorBorder:   "#FECACA",  // Error border

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
};

/* ═══════════════════════════════════════════════════════════════════════════
   FONT FAMILIES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Font family tokens.
 *
 * - `display`: Baloo 2 — headings, hero text, form titles, stats
 * - `body`: DM Sans — body copy, labels, UI text, buttons
 *
 * @example
 * import { fonts } from "./HeadlinerDesignSystem";
 * <h1 style={{ fontFamily: fonts.display, fontWeight: 800 }}>Title</h1>
 * <p style={{ fontFamily: fonts.body }}>Body text</p>
 */
export const fonts = {
  display: "'Baloo 2', sans-serif",
  body:    "'DM Sans', sans-serif",
};

/**
 * Google Fonts URL for loading Baloo 2 + DM Sans.
 * Use in a <link> tag or CSS @import.
 *
 * @example
 * <link href={googleFontsUrl} rel="stylesheet">
 */
export const googleFontsUrl =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&display=swap";

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRAM-LEVEL COLOR RULES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Program palettes define which colors dominate each program page,
 * which are accents, and what percentage of the page each color occupies.
 *
 * RULE: Crimson is always reserved for CTAs — never use it as a
 * background or decorative color on early childhood pages.
 *
 * @example
 * import { programPalettes, C } from "./HeadlinerDesignSystem";
 * const palette = programPalettes.band;
 * // palette.dominant.token → "espresso" → C[palette.dominant.token]
 */
export const programPalettes = {
  band: {
    dominant:   { token: "espresso",  pct: 55, note: "Hero and dark panel backgrounds" },
    secondary:  { token: "cream",     pct: 25, note: "Text panels, light sections" },
    accent:     { token: "crimson",   pct: 12, note: "CTAs only" },
    accent2:    { token: "teal",      pct: 8,  note: "Labels and wayfinding" },
  },
  privateLesson: {
    dominant:   { token: "cream",     pct: 50, note: "Page base, most panels" },
    secondary:  { token: "espresso",  pct: 25, note: "One or two hero panels" },
    accent:     { token: "teal",      pct: 15, note: "Primary accent, instrument labels" },
    accent2:    { token: "crimson",   pct: 10, note: "Booking CTAs only" },
  },
  summerCamp: {
    dominant:   { token: "yellow",    pct: 45, note: "Hero and section fills" },
    secondary:  { token: "cream",     pct: 30, note: "Content panels" },
    accent:     { token: "crimson",   pct: 15, note: "CTAs and energy pops" },
    accent2:    { token: "espresso",  pct: 10, note: "Headlines on yellow" },
  },
  tinyKeys: {
    dominant:   { token: "cream",     pct: 40, note: "Page base and cards" },
    secondary:  { token: "yellow",    pct: 25, note: "Primary tier accents" },
    secondary2: { token: "teal",      pct: 20, note: "Secondary tier accents" },
    accent:     { token: "crimson",   pct: 10, note: "CTAs only" },
    accent2:    { token: "blush",     pct: 5,  note: "Fourth feature card only" },
  },
  miniBeats: {
    dominant:   { token: "crimson",   pct: 40, note: "Hero and age tier cards" },
    secondary:  { token: "cream",     pct: 30, note: "Page base and content panels" },
    secondary2: { token: "espresso",  pct: 15, note: "Headlines on cream" },
    accent:     { token: "yellow",    pct: 10, note: "Playful pops and activity moments" },
    accent2:    { token: "teal",      pct: 5,  note: "CTAs and wayfinding only" },
  },
  littleRockers: {
    dominant:   { token: "crimson",  pct: 40, note: "Hero accents, stickers, card borders" },
    secondary:  { token: "cream",    pct: 30, note: "Page base and content panels" },
    secondary2: { token: "blush",    pct: 15, note: "Section fills, modal callout" },
    accent:     { token: "yellow",   pct: 10, note: "Playful pops and instrument badges" },
    accent2:    { token: "teal",     pct: 5,  note: "Wayfinding and secondary labels" },
  },
  musicAndMe: {
    dominant:   { token: "blush",     pct: 45, note: "Hero and section fills" },
    secondary:  { token: "cream",     pct: 30, note: "Cards and content panels" },
    secondary2: { token: "yellow",    pct: 12, note: "Warmth accents and highlights" },
    accent:     { token: "crimson",   pct: 8,  note: "CTAs only" },
    accent2:    { token: "teal",      pct: 5,  note: "Labels and wayfinding only" },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Button — primary CTA or secondary action.
 *
 * @param {string} variant   - "primary" | "secondary" | "ghost" | "outline" | "yellow"
 * @param {string} accent    - Color token (defaults to C.crimson)
 * @param {string} href      - If provided, renders an <a> instead of <button>
 * @param {boolean} disabled - Disables interaction and dims appearance
 * @param {string} size      - "sm" | "md" | "lg"
 * @param {function} onClick - Click handler
 * @param {object} style     - Override styles
 *
 * @example
 * <Button variant="primary" size="lg" onClick={handleClick}>Enroll Now</Button>
 * <Button variant="ghost" href="/about">Learn More</Button>
 */
export function Button({
  children,
  variant = "primary",
  accent = C.crimson,
  href,
  disabled,
  size = "md",
  style,
  className,
  onClick,
  ...rest
}) {
  const [hover, setHover] = useState(false);

  const accentHover =
    accent === C.crimson ? C.crimsonHover :
    accent === C.teal ? "#0096B4" :
    accent === C.yellow ? C.yellowHover :
    C.crimsonHover;

  let bg, color, border, hoverBg, hoverColor;
  if (variant === "primary") {
    bg = disabled ? C.border : accent;
    color = disabled ? C.muted : C.white;
    border = "none";
    hoverBg = disabled ? C.border : accentHover;
    hoverColor = disabled ? C.muted : C.white;
  } else if (variant === "secondary") {
    bg = "transparent";
    color = accent === C.teal ? C.tealDark : accent;
    border = `2.5px solid ${accent}`;
    hoverBg = "transparent";
    hoverColor = accent === C.teal ? C.tealDark : accent;
  } else if (variant === "ghost") {
    bg = C.white07;
    color = C.white80;
    border = `1px solid ${C.white15}`;
    hoverBg = C.white10;
    hoverColor = C.white;
  } else if (variant === "outline") {
    bg = "transparent";
    color = accent;
    border = `1.5px solid ${accent}`;
    hoverBg = accent;
    hoverColor = C.white;
  } else if (variant === "yellow") {
    bg = C.yellow;
    color = C.espresso;
    border = "none";
    hoverBg = C.yellowHover;
    hoverColor = C.espresso;
  }

  const pad = size === "lg" ? "16px 40px" : size === "sm" ? "10px 22px" : "13px 32px";
  const fs = size === "lg" ? 15 : size === "sm" ? 12 : 13;

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: fonts.body,
    fontSize: fs,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: pad,
    borderRadius: 999,
    border,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    transition: "all 0.2s",
    background: hover ? hoverBg : bg,
    color: hover ? hoverColor : color,
    ...style,
  };

  const Element = href ? "a" : "button";

  return (
    <Element
      href={href}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={baseStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {children}
    </Element>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL — shell with backdrop click + ESC to close; accepts children
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Modal — overlay dialog with backdrop blur, ESC to close, and body scroll lock.
 *
 * @param {node} children     - Modal content
 * @param {function} onClose  - Called when user clicks backdrop or presses ESC
 * @param {number} maxWidth   - Max width in px (default 520)
 * @param {object} style      - Override card styles
 * @param {string} closeColor - Close button icon color
 *
 * @example
 * <Modal onClose={() => setOpen(false)}>
 *   <h2>Hello world</h2>
 * </Modal>
 */
export function Modal({ children, onClose, maxWidth = 520, style, closeColor = C.muted }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: C.espresso75,
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        ref={cardRef}
        style={{
          background: C.white,
          borderRadius: 24,
          width: "100%",
          maxWidth,
          padding: "40px 36px",
          position: "relative",
          boxSizing: "border-box",
          margin: "auto",
          boxShadow: `0 24px 64px ${C.black20}`,
          border: `1px solid ${C.border}`,
          ...style,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: C.border,
            border: "none",
            borderRadius: "50%",
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: closeColor,
          }}
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EYEBROW — uppercase label + colored bar
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Eyebrow — small uppercase label with a colored bar, used above section headings.
 *
 * @param {string} accent - Color token (defaults to C.teal)
 * @param {object} style  - Override styles
 *
 * @example
 * <Eyebrow accent={C.teal}>The approach</Eyebrow>
 */
export function Eyebrow({ children, accent = C.teal, style }) {
  return (
    <p
      style={{
        fontFamily: fonts.body,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: accent,
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      <span
        style={{
          display: "block",
          width: 28,
          height: 3,
          background: accent,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHIP — label + dot
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Chip — small badge with a colored dot, used for tags and labels.
 *
 * @param {string} label  - Text to display
 * @param {string} accent - Dot color (defaults to C.crimson)
 * @param {object} style  - Override styles
 *
 * @example
 * <Chip label="Beginner" accent={C.teal} />
 */
export function Chip({ label, accent = C.crimson, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: C.white,
        border: `1.5px solid ${accent}55`,
        borderRadius: 20,
        padding: "6px 13px",
        fontSize: 13,
        fontFamily: fonts.body,
        color: C.text,
        fontWeight: 500,
        ...style,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: accent,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUBBLE — decorative blob
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bubble — decorative circular shape for background visual interest.
 *
 * @param {string|number} top    - CSS position
 * @param {string|number} right  - CSS position
 * @param {string|number} bottom - CSS position
 * @param {string|number} left   - CSS position
 * @param {number} size          - Diameter in px (default 240)
 * @param {string} color         - Fill color (defaults to C.tealPastel)
 * @param {number} opacity       - 0–1 (default 1)
 * @param {object} style         - Override styles
 *
 * @example
 * <Bubble top={-40} right={-40} size={200} color={C.yellowPastel} opacity={0.6} />
 */
export function Bubble({ top, right, bottom, left, size = 240, color = C.tealPastel, opacity = 1, style }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        right,
        bottom,
        left,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE DIVIDER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * WaveDivider — SVG wave transition between sections of different colors.
 *
 * @param {string} from      - Top section color
 * @param {string} to        - Bottom section color
 * @param {string} direction - "down" (wave dips down) | "up" (wave rises up)
 *
 * @example
 * <WaveDivider from={C.espresso} to={C.cream} direction="down" />
 */
export function WaveDivider({ from, to, direction = "down" }) {
  const isDown = direction === "down";
  return (
    <svg
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      style={{
        display: "block",
        width: "100%",
        height: 48,
        background: from,
        marginBottom: isDown ? -1 : 0,
        marginTop: isDown ? 0 : -1,
      }}
      aria-hidden="true"
    >
      <path
        d={isDown ? "M0,0 C480,56 960,56 1440,0 L1440,56 L0,56 Z" : "M0,56 C480,0 960,0 1440,56 L1440,0 L0,0 Z"}
        fill={to}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEXT BLOCK — semantic typography with variant + accent
   ═══════════════════════════════════════════════════════════════════════════ */

const TEXT_VARIANTS = {
  display: {
    fontFamily: fonts.display,
    fontWeight: 800,
    fontSize: "clamp(56px, 9vw, 88px)",
    lineHeight: 0.9,
    letterSpacing: "-0.04em",
    color: C.espresso,
  },
  heading: {
    fontFamily: fonts.display,
    fontWeight: 800,
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
    color: C.espresso,
  },
  subheading: {
    fontFamily: fonts.display,
    fontWeight: 400,
    fontSize: "clamp(22px, 3.5vw, 32px)",
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
    color: C.muted,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 1.75,
    color: C.muted,
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: C.tealDark,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 1.5,
    color: C.muted,
  },
};

/**
 * TextBlock — semantic typography component with predefined variants.
 *
 * @param {string} variant - "display" | "heading" | "subheading" | "body" | "eyebrow" | "caption"
 * @param {string} accent  - Override text color
 * @param {string} as      - HTML tag (default "p", e.g. "h1", "h2", "span")
 * @param {object} style   - Override styles
 *
 * @example
 * <TextBlock variant="heading" as="h2">Section title</TextBlock>
 * <TextBlock variant="body">Lorem ipsum dolor sit amet.</TextBlock>
 */
export function TextBlock({ variant = "body", accent, children, style, as: Tag = "p" }) {
  const base = TEXT_VARIANTS[variant] || TEXT_VARIANTS.body;
  return (
    <Tag
      style={{
        margin: 0,
        ...base,
        ...(accent ? { color: accent } : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORM PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * FormField — label + input wrapper with optional hint text.
 *
 * @param {string} label   - Uppercase label above the input
 * @param {string} hint    - Small helper text below the input
 *
 * @example
 * <FormField label="Full name" hint="First and last">
 *   <Input placeholder="Jane Doe" />
 * </FormField>
 */
export function FormField({ label, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: fonts.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontFamily: fonts.body, fontSize: 11, color: C.subtext, margin: "4px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Input — styled text input with focus states.
 *
 * @param {string} accent - Focus border color (defaults to C.crimson)
 * @param {object} style  - Override styles
 * @param {...*} rest     - Passed to the underlying <input>
 *
 * @example
 * <Input type="email" placeholder="you@email.com" />
 */
export function Input({ accent = C.crimson, style, ...rest }) {
  return (
    <input
      style={{
        background: C.inputBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        color: C.espresso,
        fontFamily: fonts.body,
        fontSize: 14,
        padding: "10px 14px",
        width: "100%",
        boxSizing: "border-box",
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
        ...style,
      }}
      onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.background = C.white; }}
      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.background = C.inputBg; }}
      {...rest}
    />
  );
}

/**
 * Select — styled dropdown with chevron icon.
 *
 * @param {string} accent  - Focus border color (defaults to C.crimson)
 * @param {node} children  - <option> elements
 * @param {object} style   - Override wrapper styles
 * @param {...*} rest      - Passed to the underlying <select>
 *
 * @example
 * <Select>
 *   <option value="">Choose…</option>
 *   <option value="guitar">Guitar</option>
 * </Select>
 */
export function Select({ accent = C.crimson, children, style, ...rest }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <select
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: C.inputBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          color: C.espresso,
          fontFamily: fonts.body,
          fontSize: 14,
          padding: "10px 36px 10px 14px",
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
          transition: "border-color 0.2s, background 0.2s",
        }}
        onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.background = C.white; }}
        onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.background = C.inputBg; }}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: C.subtext,
        }}
      />
    </div>
  );
}

/**
 * Textarea — styled multiline input with focus states.
 *
 * @param {string} accent - Focus border color (defaults to C.crimson)
 * @param {object} style  - Override styles
 * @param {...*} rest     - Passed to the underlying <textarea>
 *
 * @example
 * <Textarea rows={4} placeholder="Tell us about yourself" />
 */
export function Textarea({ accent = C.crimson, style, ...rest }) {
  return (
    <textarea
      style={{
        background: C.inputBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        color: C.espresso,
        fontFamily: fonts.body,
        fontSize: 14,
        padding: "10px 14px",
        width: "100%",
        boxSizing: "border-box",
        outline: "none",
        resize: "vertical",
        transition: "border-color 0.2s, background 0.2s",
        ...style,
      }}
      onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.background = C.white; }}
      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.background = C.inputBg; }}
      {...rest}
    />
  );
}

/**
 * PillToggle — selectable pill button for multi-option forms.
 *
 * @param {string} label   - Button text
 * @param {boolean} active - Whether this pill is selected
 * @param {function} onClick - Click handler
 * @param {string} accent  - Active color (defaults to C.crimson)
 *
 * @example
 * <PillToggle label="Beginner" active={level === "Beginner"} onClick={() => setLevel("Beginner")} />
 */
export function PillToggle({ label, active, onClick, accent = C.crimson }) {
  const accentSoft = accent === C.crimson ? C.crimson06 :
    accent === C.teal ? C.teal06 : C.crimson06;
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: active ? `1.5px solid ${accent}` : `1px solid ${C.border}`,
        background: active ? accentSoft : C.inputBg,
        color: active ? accent : C.muted,
        fontFamily: fonts.body,
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTA SECTION — end-of-page CTA strip
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * CTASection — dark espresso CTA strip for the bottom of a page.
 *
 * @param {string} eyebrow     - Small uppercase label above the title
 * @param {string} title       - Main heading text
 * @param {string} titleAccent - Colored word at the end of the title
 * @param {string} body        - Description paragraph
 * @param {node} children      - Button(s) to render below
 * @param {string} accent      - Eyebrow color (defaults to C.teal)
 * @param {object} style       - Override section styles
 *
 * @example
 * <CTASection
 *   eyebrow="Ready to start?"
 *   title="Let's make"
 *   titleAccent="music."
 *   body="Book your first lesson today."
 * >
 *   <Button>Request Lessons</Button>
 * </CTASection>
 */
export function CTASection({
  eyebrow,
  title,
  titleAccent,
  body,
  children,
  accent = C.teal,
  style,
}) {
  return (
    <section
      style={{
        background: C.espresso,
        padding: "72px 24px",
        textAlign: "center",
        ...style,
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {eyebrow && (
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: accent,
              margin: "0 0 16px",
            }}
          >
            {eyebrow}
          </p>
        )}
        {title && (
          <h2
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: "clamp(28px, 4vw, 44px)",
              color: C.white,
              margin: "0 0 12px",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {title}{" "}
            {titleAccent && <span style={{ color: C.crimson }}>{titleAccent}</span>}
          </h2>
        )}
        {body && (
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              color: C.white70,
              margin: "0 0 32px",
              lineHeight: 1.65,
            }}
          >
            {body}
          </p>
        )}
        {children && (
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ LIST — stacked Q&A
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * FAQList — stacked question/answer list with dividers.
 *
 * @param {array} items  - Array of { q: string, a: string }
 * @param {string} accent - (unused, reserved for future styling)
 * @param {object} style  - Override container styles
 *
 * @example
 * <FAQList items={[
 *   { q: "Do I need experience?", a: "No — we welcome all levels." },
 *   { q: "What instruments?", a: "Guitar, piano, drums, and more." },
 * ]} />
 */
export function FAQList({ items, accent = C.crimson, style }) {
  return (
    <div style={{ maxWidth: 800, ...style }}>
      {items.map(({ q, a }, i) => (
        <div
          key={i}
          style={{
            paddingBottom: 32,
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none",
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 18,
              color: C.espresso,
              margin: "0 0 12px",
              lineHeight: 1.2,
            }}
          >
            {q}
          </h3>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.85,
              margin: 0,
            }}
          >
            {a}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATS GRID — label/value cells
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * StatsGrid — grid of label/value cells with hairline borders.
 *
 * @param {array} items   - Array of { label: string, value: string, color?: string }
 * @param {number} columns - Grid columns (default 3)
 * @param {object} style   - Override grid styles
 *
 * @example
 * <StatsGrid columns={4} items={[
 *   { label: "Dates", value: "June 22–26" },
 *   { label: "Ages", value: "8–12", color: C.teal },
 * ]} />
 */
export function StatsGrid({ items, columns = 3, style }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 1,
        background: C.border,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {items.map(({ label, value, color }, i) => (
        <div
          key={i}
          style={{
            background: C.white,
            padding: "28px 24px",
          }}
        >
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.muted,
              margin: "0 0 8px",
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 22,
              color: color || C.espresso,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARD — photo + content shell
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Card — rounded card with optional image header and accent border.
 *
 * @param {string} image       - Image URL (optional)
 * @param {string} imageAlt    - Alt text for the image
 * @param {number} imageHeight - Image area height in px (default 160)
 * @param {string} imageBg     - Fallback background color while loading
 * @param {string} accent      - Border accent color (defaults to C.crimson)
 * @param {node} children      - Card content
 * @param {object} style       - Override card styles
 *
 * @example
 * <Card image="/photo.jpg" imageAlt="Student playing guitar" accent={C.teal}>
 *   <h3>Guitar Lessons</h3>
 *   <p>Acoustic & electric, all levels.</p>
 * </Card>
 */
export function Card({
  image,
  imageAlt = "",
  imageHeight = 160,
  imageBg = C.offWhite,
  accent = C.crimson,
  children,
  style,
}) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 20,
        border: `2px solid ${accent}50`,
        overflow: "hidden",
        ...style,
      }}
    >
      {image && (
        <div
          style={{
            height: imageHeight,
            background: imageBg,
            overflow: "hidden",
          }}
        >
          <img
            src={image}
            alt={imageAlt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              e.target.parentElement.style.background = imageBg;
              e.target.style.display = "none";
            }}
          />
        </div>
      )}
      <div style={{ padding: "18px 20px 22px" }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STYLES — shared CSS string for <style> blocks
   Drop into any page: <style>{globalStyles}</style>
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * globalStyles — shared CSS string with resets, animations, and responsive rules.
 * Drop into any page: <style>{globalStyles}</style>
 *
 * Includes:
 * - Box-sizing reset
 * - Text selection color (crimson tint)
 * - Overflow-x lock
 * - fadeUp animation + delay utilities (.fade-up, .delay-1 through .delay-5)
 * - Marquee animation
 * - Pulse animation for .tag-dot
 * - Mobile padding adjustments
 */
export const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  ::selection { background: ${C.crimson15}; color: ${C.espresso}; }
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  * { min-width: 0; box-sizing: border-box; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up  { animation: fadeUp 0.65s ease both; }
  .delay-1  { animation-delay: 0.08s; }
  .delay-2  { animation-delay: 0.18s; }
  .delay-3  { animation-delay: 0.28s; }
  .delay-4  { animation-delay: 0.38s; }
  .delay-5  { animation-delay: 0.48s; }

  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .marquee-track { animation: marquee 24s linear infinite; display: flex; width: max-content; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
  }
  .tag-dot {
    width: 6px; height: 6px; border-radius: 50%; background: ${C.crimson};
    animation: pulse 2s ease-in-out infinite;
    display: inline-block; flex-shrink: 0;
  }

  @media (max-width: 768px) {
    section { padding-left: 20px !important; padding-right: 20px !important; }
    header  { padding-left: 20px !important; padding-right: 20px !important; }
  }
`;