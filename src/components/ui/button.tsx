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
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg";

    const variants = {
      primary:
        "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
      secondary:
        "border border-border bg-surface text-text-primary hover:bg-gray-50 active:bg-gray-100",
      danger:
        "bg-danger text-white hover:bg-red-700 active:bg-red-800",
      ghost:
        "text-text-secondary hover:bg-gray-100 hover:text-text-primary active:bg-gray-200",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    if (asChild) {
      // When asChild, clone the single child element with merged props
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
