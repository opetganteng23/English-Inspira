import type { Config } from "tailwindcss";

// Warna = token CSS MTS v2.4 §27.3 (app/globals.css), sehingga mode gelap dan tema dapat diganti tanpa mengubah komponen.
// Nama lama (navy, brand, accent, success, ink, line, canvas) dipertahankan dan dipetakan ke token baru.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "var(--primary)", 700: "var(--primary-hover)", 800: "var(--primary-hover)" },
        brand: { DEFAULT: "var(--primary)", dark: "var(--primary-hover)", tint: "var(--primary-soft)" },
        accent: { DEFAULT: "var(--gold)", dark: "var(--attention)", tint: "var(--attention-soft)" },
        success: { DEFAULT: "var(--calm)", tint: "var(--calm-soft)" },
        ink: { DEFAULT: "var(--text)", soft: "var(--text-muted)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        canvas: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        "on-primary": "var(--on-primary)",
        blue: { DEFAULT: "var(--blue)", soft: "var(--blue-soft)" },
        gold: { DEFAULT: "var(--gold)", soft: "var(--gold-soft)" },
        attention: { DEFAULT: "var(--attention)", soft: "var(--attention-soft)" },
        calm: { DEFAULT: "var(--calm)", soft: "var(--calm-soft)" },
        critical: { DEFAULT: "var(--critical)", soft: "var(--critical-soft)" },
        mist: "#D3DEEE",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"], // judul juga Poppins
      },
      maxWidth: { measure: "68ch" },
      transitionDuration: { DEFAULT: "var(--dur)" },
    },
  },
  plugins: [],
};
export default config;
