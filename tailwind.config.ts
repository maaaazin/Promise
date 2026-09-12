import type { Config } from "tailwindcss";
export default { 
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], 
  theme: { 
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      }
    } 
  }, 
  plugins: [] 
} satisfies Config;
