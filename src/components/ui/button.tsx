import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";

    const variants = {
      primary: [
        "bg-gradient-to-b from-[var(--color-primary-light)] to-[var(--color-primary)]",
        "text-white shadow-md",
        "hover:shadow-glow hover:-translate-y-px",
        "active:scale-[0.98] active:shadow-sm",
        "focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-[var(--color-bg)]",
      ].join(" "),
      secondary: [
        "bg-[var(--glass-bg)] backdrop-blur-xl",
        "border border-[var(--glass-border)]",
        "text-[var(--color-text)] shadow-sm",
        "hover:bg-[var(--glass-bg-hover)] hover:shadow-md hover:-translate-y-px",
        "active:scale-[0.98] active:bg-[var(--glass-bg-active)]",
        "focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-[var(--color-bg)]",
      ].join(" "),
      danger: [
        "bg-red-500/10 text-[var(--color-danger)]",
        "border border-red-500/15",
        "hover:bg-red-500/15 hover:-translate-y-px hover:shadow-md",
        "active:scale-[0.98] active:bg-red-500/20",
        "focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-[var(--color-bg)]",
      ].join(" "),
      ghost: [
        "text-[var(--color-text-secondary)]",
        "hover:bg-black/[0.04] hover:text-[var(--color-text)]",
        "active:scale-[0.97] active:bg-black/[0.06]",
        "focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-[var(--color-bg)]",
      ].join(" "),
    };

    const sizes = {
      sm: "h-8 px-3 py-1.5 text-sm gap-1.5",
      md: "h-10 px-4 py-2.5 text-sm gap-2",
      lg: "h-12 px-6 py-3 text-base gap-2.5",
    };

    if (asChild) {
      const child = React.Children.only(
        props.children
      ) as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return React.cloneElement(child, {
        className: cn(baseStyles, variants[variant], sizes[size], className, child.props.className),
        ...props,
        children: child.props.children,
      });
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
