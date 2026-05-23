import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand surfaces
        cream: "#F9F5F0",
        wheat: "#F2EAD3",
        // Ink (deep olive)
        ink: "#344F1F",
        // Burnt-orange accent
        ember: "#F4991A",
        // Semantic aliases (kept so untouched components still resolve)
        bg: "#F9F5F0",
        fg: "#344F1F",
        muted: "#344F1F",
        accent: "#F4991A",
        danger: "#A8321A",
        ok: "#344F1F",
      },
      fontFamily: {
        display: ["var(--font-display)", "Source Serif 4", "Georgia", "serif"],
        sans: ["var(--font-body)", "Inter Tight", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.22em",
        wordmark: "-0.01em",
      },
      borderColor: {
        hairline: "rgba(52, 79, 31, 0.20)",
      },
    },
  },
  plugins: [],
};

export default config;
