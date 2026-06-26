import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      colors: {
        ink: "#111111",
        mist: "#f5f4f1",
        stone: "#d8d5cf",
        graphite: "#6c6a66"
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.19, 1, 0.22, 1)"
      },
      animation: {
        "slow-fade": "slowFade 1.4s cubic-bezier(0.19, 1, 0.22, 1) both",
        "image-drift": "imageDrift 18s ease-in-out infinite alternate"
      },
      keyframes: {
        slowFade: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        imageDrift: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.06)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
