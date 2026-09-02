import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: c("--bg"),
        surface: c("--surface"),
        "surface-2": c("--surface-2"),
        overlay: c("--overlay"),
        border: c("--border"),
        "border-strong": c("--border-strong"),
        fg: {
          DEFAULT: c("--fg"),
          muted: c("--fg-muted"),
          subtle: c("--fg-subtle"),
        },
        brand: {
          DEFAULT: c("--brand"),
          hi: c("--brand-hi"),
          hover: c("--brand-hover"),
          fg: c("--brand-fg"),
          subtle: c("--brand-subtle"),
          accent: c("--brand-accent"),
        },
        success: {
          DEFAULT: c("--success"),
          subtle: c("--success-subtle"),
          fg: c("--success-fg"),
        },
        warning: {
          DEFAULT: c("--warning"),
          subtle: c("--warning-subtle"),
          fg: c("--warning-fg"),
        },
        danger: {
          DEFAULT: c("--danger"),
          subtle: c("--danger-subtle"),
          fg: c("--danger-fg"),
        },
        info: {
          DEFAULT: c("--info"),
          subtle: c("--info-subtle"),
          fg: c("--info-fg"),
        },
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      backgroundImage: {
        "brand-grad":
          "linear-gradient(180deg, rgb(var(--brand-hi)), rgb(var(--brand)))",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      ringColor: {
        DEFAULT: c("--ring"),
      },
    },
  },
  plugins: [],
};

export default config;
