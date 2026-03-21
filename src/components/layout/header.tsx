"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  collapsed?: boolean;
}

export function Header({ breadcrumbs, collapsed }: HeaderProps) {
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
        "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-sm px-6 transition-all duration-200",
        collapsed ? "ml-[72px]" : "ml-[260px]"
      )}
    >
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && (
                  <span className="text-text-muted">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-text-primary font-medium">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <span className="text-sm text-text-secondary">
            {session?.user?.name ? `Willkommen, ${session.user.name.split(" ")[0]}` : "ARCANA"}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-border" />

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">
          {userInitials}
        </div>
      </div>
    </header>
  );
}
