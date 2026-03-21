import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const badgeVariants = {
  default:
    "bg-black/[0.04] dark:bg-white/[0.06] text-[var(--color-text-secondary)] border-black/[0.06] dark:border-white/[0.08]",
  success:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
  danger:
    "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/15",
  info:
    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/15",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200 select-none",
        "backdrop-blur-sm",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
