import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#29231E",
        muted: "#5F564D",
        line: "#DDD0BE",
        glass: {
          panel: "#FAF5ED",
          card: "#FFF9F1",
          hover: "#F6EAD9"
        },
        brand: {
          50: "#FFF4E5",
          100: "#F6E4C9",
          300: "#E4BD86",
          500: "#D9892B",
          600: "#BD7024",
          700: "#9A5B21"
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
          800: "#5F564D",
          900: "#3D352E",
          950: "#29231E"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(82, 61, 39, 0.08)",
        lift: "0 18px 42px rgba(82, 61, 39, 0.12)",
        glow: "0 0 0 2px rgba(217, 137, 43, 0.18)",
        glass: "0 18px 42px rgba(82, 61, 39, 0.12)"
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
