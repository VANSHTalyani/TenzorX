import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#7fb5ea",
          400: "#3b8fd4",
          500: "#0F4C81",
          600: "#0a3d6e",
          700: "#0a3559",
          800: "#092d4a",
          900: "#071f33",
          DEFAULT: "#0F4C81",
          dark: "#0a3559",
          light: "#3b8fd4",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          DEFAULT: "#f59e0b",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06)",
        glow: "0 0 20px rgba(15,76,129,.15)",
      },
      animation: {
        "fade-in": "fadeIn .4s ease-out",
        "slide-up": "slideUp .4s ease-out",
        "slide-in-right": "slideInRight .3s ease-out",
        "pulse-ring": "pulseRing 1.5s cubic-bezier(.4,0,.6,1) infinite",
        "progress": "progressBar 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideInRight: { from: { opacity: "0", transform: "translateX(12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        pulseRing: { "0%": { transform: "scale(.95)", opacity: "1" }, "75%,100%": { transform: "scale(1.5)", opacity: "0" } },
        progressBar: { "0%": { width: "0%" }, "50%": { width: "70%" }, "100%": { width: "100%" } },
      },
    },
  },
  plugins: [],
};
export default config;
