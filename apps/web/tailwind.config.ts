import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080B10",
        muted: "#B7C0CE",
        line: "#2A3545",
        glass: {
          panel: "#151B24",
          card: "#1B2330",
          hover: "#232D3B"
        },
        brand: {
          50: "#EAF2FF",
          100: "#CFE1FF",
          300: "#93C5FD",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8"
        },
        mint: {
          50: "#ecfdf5",
          500: "#10b981"
        },
        amberish: {
          50: "#fff7ed",
          500: "#ea580c"
        },
        coral: {
          50: "#fff1f2",
          500: "#f43f5e",
          600: "#e11d48"
        },
        graphite: {
          800: "#1B2330",
          900: "#151B24",
          950: "#080B10"
        }
      },
      boxShadow: {
        soft: "0 14px 38px rgba(0, 0, 0, 0.3)",
        lift: "0 18px 46px rgba(0, 0, 0, 0.36)",
        glow: "0 0 0 1px rgba(59, 130, 246, 0.28)",
        glass: "0 18px 52px rgba(0, 0, 0, 0.38)"
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "120% 0" },
          "100%": { backgroundPosition: "-120% 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 1.35s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
