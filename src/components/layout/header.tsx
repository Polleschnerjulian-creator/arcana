"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  collapsed?: boolean;
  onMobileMenuToggle?: () => void;
}

export function Header({ breadcrumbs, collapsed, onMobileMenuToggle }: HeaderProps) {
  const { data: session } = useSession();

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center justify-between px-4 md:px-6 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        // Desktop: offset by sidebar width
        collapsed ? "md:ml-[72px]" : "md:ml-[260px]",
        // Mobile: no left margin
        "ml-0"
      )}
      style={{
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        boxShadow: "0 1px 0 rgba(0, 0, 0, 0.04), 0 2px 12px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* Left: Hamburger (mobile) + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.5)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[rgba(255,255,255,0.7)] transition-all duration-200 md:hidden -ml-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          aria-label="Menue oeffnen"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && (
                  <span className="text-[var(--color-text-tertiary)] select-none">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors duration-200"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-[var(--color-text)] font-medium">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {session?.user?.name ? `Willkommen, ${session.user.name.split(" ")[0]}` : "ARCANA"}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.4)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.65)] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-white text-xs font-semibold shadow-[0_2px_8px_rgba(13,148,136,0.25)] cursor-pointer transition-transform duration-200 hover:scale-105">
          {userInitials}
        </div>
      </div>
    </header>
  );
}
