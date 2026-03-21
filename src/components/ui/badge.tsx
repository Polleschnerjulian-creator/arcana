import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const badgeVariants = {
  default:
    "bg-gray-100 text-text-secondary border-border",
  success:
    "bg-success-light text-success border-green-200",
  warning:
    "bg-warning-light text-warning border-amber-200",
  danger:
    "bg-danger-light text-danger border-red-200",
  info:
    "bg-info-light text-info border-blue-200",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
