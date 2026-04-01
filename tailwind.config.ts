import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      /* Sharp UI: no rounded corners except `rounded-full` for avatars */
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
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
        accent: "#e87a3d",
        green: "#22c55e",
        gold: "#c9a06b",
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
