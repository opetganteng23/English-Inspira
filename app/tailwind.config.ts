import type { Config } from "tailwindcss";

// Token diambil dari desain "English Inspira — Redesign Website".
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0F2F5E", 700: "#173E73", 800: "#123F7C" },
        brand: { DEFAULT: "#1B5FB8", dark: "#123F7C", tint: "#E9F0FA" },
        accent: { DEFAULT: "#F08A1C", dark: "#B85A00", tint: "#FDEBD6" },
        success: { DEFAULT: "#1D6B3F", tint: "#E6F4EC" },
        ink: { DEFAULT: "#1C2B44", soft: "#4B5A70" },
        line: { DEFAULT: "#DCE3ED", strong: "#C5D2E4" },
        canvas: "#F5F7FA",
        mist: "#D3DEEE",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
