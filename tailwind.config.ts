import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Actions ───────────────────────────────────────────
        primary: "#FF0044",
        "primary-hover": "#CC0036",
        secondary: "#00A8C8",
        "secondary-hover": "#0096B4",
        "secondary-dark": "#006E84",

        // ── Status ──────────────────────────────────────────
        success: "#3D8B5F",
        "success-light": "#DCF0E4",
        "success-dark": "#1F5C3A",
        warning: "#FFDA00",
        "warning-light": "#FFF7CC",
        "warning-dark": "#7A5F00",
        error: "#DC2626",
        "error-light": "#FEF2F2",
        "error-border": "#FECACA",
        info: "#C8F0F8",
        "info-dark": "#006E84",

        // ── Surfaces ──────────────────────────────────────────
        sidebar: "#1A130F",
        "sidebar-hover": "#251A14",
        "sidebar-active": "#2F2118",
        "sidebar-text": "rgba(255,255,255,0.55)",
        "sidebar-text-active": "#FFFFFF",
        bg: "#FAF6F0",
        surface: "#FFFFFF",
        card: "#FFFFFF",
        "input-bg": "#FAFAF8",
        "off-white": "#F2EDE6",

        // ── Text ──────────────────────────────────────────────
        "text-primary": "#2C1F18",
        "text-secondary": "#7A6860",
        "text-muted": "#AAAAAA",
        "text-on-dark": "#FFFFFF",
        "text-on-dark-muted": "rgba(255,255,255,0.70)",

        // ── Borders ─────────────────────────────────────────
        border: "#E8E2DA",
        "border-light": "#FAF6F0",
        "border-focus": "#FF0044",
        "border-secondary": "#00A8C8",

        // ── Highlights ──────────────────────────────────────
        highlight: "rgba(255,0,68,0.15)",
        "highlight-secondary": "rgba(0,168,200,0.16)",
        "highlight-success": "rgba(61,139,95,0.15)",
        "highlight-warning": "rgba(255,218,0,0.12)",

        // ── Legacy aliases (deprecated, use semantic names above) ─
        accent: "#FF0044",
        "accent-light": "rgba(255,0,68,0.15)",
        "accent-hover": "#CC0036",
      },
      fontFamily: {
        display: ["var(--font-baloo-2)"],
        sans: ["var(--font-dm-sans)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;