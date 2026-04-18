import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#FFFFFF",
          card: "#F9F9FB",
          border: "#E5E7EB",
          accent: "#8A4DFF",
          "accent-hover": "#7A3DEF",
          muted: "#6B7280",
          text: "#0B0F2A",
          cyan: "#2EC7FF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
