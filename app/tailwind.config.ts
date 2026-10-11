import type { Config } from "tailwindcss";

// Token diambil dari desain "English Inspira — Redesign Website".
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0A2257", 700: "#13357A", 800: "#083B7D" },
        brand: { DEFAULT: "#0B4FA6", dark: "#083B7D", tint: "#E6EEFA" },
        accent: { DEFAULT: "#D9A02F", dark: "#8A5A00", tint: "#FBF1DB" },
        success: { DEFAULT: "#1D6B3F", tint: "#E6F4EC" },
        ink: { DEFAULT: "#1C2B44", soft: "#4B5A70" },
        line: { DEFAULT: "#DCE3ED", strong: "#C5D2E4" },
        canvas: "#F5F7FA",
        mist: "#D3DEEE",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"], // judul juga Poppins
      },
    },
  },
  plugins: [],
};
export default config;
