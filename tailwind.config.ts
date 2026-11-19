import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080b12",
          900: "#0c111b",
          850: "#111825",
          800: "#151d2b",
          750: "#1a2333",
          700: "#222d3f",
          600: "#2f3c50",
        },
        gold: {
          50: "#fbf6e9",
          100: "#f3e7c4",
          200: "#e9ce8c",
          300: "#dcb45c",
          400: "#c99a3d",
          500: "#b8822c",
          600: "#986722",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px -20px rgba(0,0,0,.8)",
        gold: "0 8px 30px -12px rgba(201,154,61,.45)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
