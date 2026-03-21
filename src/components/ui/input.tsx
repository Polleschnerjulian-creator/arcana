import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type = "text", ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-xl px-3.5 py-2 text-sm",
            "bg-[var(--glass-bg)] backdrop-blur-xl",
            "border border-[var(--glass-border)]",
            "shadow-inner",
            "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[var(--color-danger)]/40 focus:ring-red-500/15 focus:border-[var(--color-danger)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
