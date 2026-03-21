"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("arcana-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("arcana-theme", next ? "dark" : "light");
  }

  // Prevent hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full" />
    );
  }

  return (
    <button
      onClick={toggle}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--glass-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border)] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-label={dark ? "Helles Design" : "Dunkles Design"}
    >
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        {dark ? (
          <Sun
            className="h-[18px] w-[18px] animate-in"
            strokeWidth={1.5}
          />
        ) : (
          <Moon
            className="h-[18px] w-[18px] animate-in"
            strokeWidth={1.5}
          />
        )}
      </span>
    </button>
  );
}
