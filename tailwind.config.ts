import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0D9488",
          hover: "#0F766E",
          light: "#CCFBF1",
          50: "#F0FDFA",
        },
        background: "#FAFAF9",
        surface: "#FFFFFF",
        border: "#E7E5E4",
        "border-hover": "#D6D3D1",
        "text-primary": "#1C1917",
        "text-secondary": "#78716C",
        "text-muted": "#A8A29E",
        success: {
          DEFAULT: "#16A34A",
          light: "#DCFCE7",
        },
        warning: {
          DEFAULT: "#D97706",
          light: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#DC2626",
          light: "#FEE2E2",
        },
        info: {
          DEFAULT: "#2563EB",
          light: "#DBEAFE",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      spacing: {
        sidebar: "260px",
        "sidebar-collapsed": "72px",
        header: "56px",
      },
    },
  },
  plugins: [],
};
export default config;
