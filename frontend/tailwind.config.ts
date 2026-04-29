import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nexus: {
          bg:             "#FFFFFF",
          card:           "#F0F9FF",
          border:         "#CCE8F0",
          accent:         "#0891B2",
          "accent-hover": "#0E7490",
          secondary:      "#FF00AA",
          muted:          "#6B7280",
          text:           "#111827",
          cyan:           "#00F5FF",
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
