import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import containerQueries from "@tailwindcss/container-queries";

// Design tokens below were sampled directly from the Figma screenshots
// (see /docs or PR description) rather than guessed, so hex values here
// intentionally mirror Bootstrap's default palette used in the source design.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#007bff",
          hover: "#0069d9",
          50: "#e6f0ff",
        },
        danger: "#dc3545",
        warning: "#ffc107",
        muted: "#6c757d",
        meta: "#868e96",
        graytext: "#495057",
        navy: "#002050",
        charcoal: "#272b41",
        ink: "#212529",
        border: {
          DEFAULT: "#ced4da",
          card: "#dfdfdf",
        },
        surface: {
          page: "#f8f9fa",
          card: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      keyframes: {
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-from-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-in-from-right": "slide-in-from-right 300ms ease-out forwards",
        "slide-in-from-left": "slide-in-from-left 300ms ease-out forwards",
      },
    },
  },
  plugins: [
    containerQueries,
    tailwindcssAnimate,
  ],
};

export default config;
