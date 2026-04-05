import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      /* Minor rounding: interactive panels, fields, chips (avatars still use rounded-full) */
      borderRadius: {
        none: "0",
        sm: "0.1875rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        label: "0.18em"
      },
      colors: {
        background: "#05070c",
        panel: "#0a0f17",
        panelAlt: "#0f1621",
        border: "#212a37",
        /** Primary (gold) — fills, key emphasis; alias `accent` for legacy classes */
        gold: {
          DEFAULT: "#D4AF37",
          hover: "#E6C65C",
          muted: "#8C7423"
        },
        /** Secondary (teal) — text links, subtle hovers, secondary actions */
        teal: {
          DEFAULT: "#2EC4B6",
          hover: "#3ED8C9",
          muted: "#1E8F85"
        },
        accent: "#D4AF37",
        green: "#22c55e",
        muted: "#95a1b4"
      },
      boxShadow: {
        soft: "0 20px 45px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
