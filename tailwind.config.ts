import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D1D1F",
          light: "#3A3A3C",
          dark: "#000000",
          hover: "#000000",
          50: "#F5F5F7",
          glow: "rgba(0, 0, 0, 0.08)",
        },
        background: "#F5F5F7",
        surface: "rgba(255, 255, 255, 0.72)",
        border: "rgba(255, 255, 255, 0.5)",
        "border-hover": "rgba(255, 255, 255, 0.7)",
        "text-primary": "#1D1D1F",
        "text-secondary": "#86868B",
        "text-muted": "#AEAEB2",
        success: {
          DEFAULT: "#30D158",
          light: "rgba(48, 209, 88, 0.12)",
        },
        warning: {
          DEFAULT: "#FFD60A",
          light: "rgba(255, 214, 10, 0.12)",
        },
        danger: {
          DEFAULT: "#FF453A",
          light: "rgba(255, 69, 58, 0.12)",
        },
        info: {
          DEFAULT: "#64D2FF",
          light: "rgba(100, 210, 255, 0.12)",
        },
        // Apple neutral scale
        gray: {
          50: "#F5F5F7",
          100: "#E8E8ED",
          200: "#D2D2D7",
          300: "#AEAEB2",
          400: "#86868B",
          500: "#6E6E73",
          600: "#48484A",
          700: "#3A3A3C",
          800: "#2C2C2E",
          900: "#1D1D1F",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],        // 11px
        xs: ["0.75rem", { lineHeight: "1.125rem" }],          // 12px
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],         // 13px
        base: ["0.9375rem", { lineHeight: "1.5rem" }],        // 15px
        lg: ["1.0625rem", { lineHeight: "1.625rem" }],        // 17px
        xl: ["1.25rem", { lineHeight: "1.75rem" }],           // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem" }],            // 24px
        "3xl": ["1.75rem", { lineHeight: "2.25rem" }],        // 28px
        "4xl": ["2.125rem", { lineHeight: "2.5rem" }],        // 34px
      },
      borderRadius: {
        DEFAULT: "16px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "24px",
        "2xl": "28px",
        "3xl": "32px",
      },
      boxShadow: {
        sm: "0 1px 4px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.06)",
        DEFAULT: "0 2px 16px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.08)",
        md: "0 4px 20px rgba(0, 0, 0, 0.07), 0 0 1px rgba(0, 0, 0, 0.08)",
        lg: "0 8px 32px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)",
        xl: "0 16px 48px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.1)",
        glow: "0 0 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)",
        "glow-lg": "0 0 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)",
        inner: "inset 0 1px 3px rgba(0, 0, 0, 0.04)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        bounce: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      spacing: {
        sidebar: "260px",
        "sidebar-collapsed": "72px",
        header: "56px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
