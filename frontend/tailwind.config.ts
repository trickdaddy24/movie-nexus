import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#0a0a0f",
          card: "#12121a",
          border: "#1e1e2e",
          accent: "#6366f1",
          "accent-hover": "#818cf8",
          muted: "#71717a",
          text: "#e4e4e7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
