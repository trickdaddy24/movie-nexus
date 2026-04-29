import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nexus: {
          bg:             "#FFFFFF",
          card:           "#FFF5F5",
          border:         "#FFD6E8",
          accent:         "#FF006E",
          "accent-hover": "#E0005C",
          secondary:      "#3BFF6B",
          tertiary:       "#FFE600",
          muted:          "#6B7280",
          text:           "#111827",
          cyan:           "#3BFF6B",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
