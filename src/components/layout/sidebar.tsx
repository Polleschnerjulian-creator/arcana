"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Building2,
  Receipt,
  BarChart3,
  BookOpen,
  Calculator,
  Settings,
  ChevronLeft,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Buchungen", href: "/transactions", icon: ArrowLeftRight },
  { name: "Belege", href: "/documents", icon: FileText },
  { name: "Bank", href: "/bank", icon: Building2 },
  { name: "Rechnungen", href: "/invoices", icon: Receipt },
];

const secondaryNavigation = [
  { name: "Berichte", href: "/reports", icon: BarChart3 },
  { name: "Kontenplan", href: "/accounts", icon: BookOpen },
  { name: "Steuer", href: "/tax", icon: Calculator },
];

const settingsNavigation = [
  { name: "Einstellungen", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const prevPathnameRef = React.useRef(pathname);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      onMobileClose();
    }
  }, [pathname, onMobileClose]);

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  function renderNavItem(item: { name: string; href: string; icon: LucideIcon }) {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ease-out min-h-[44px] md:min-h-0",
          isActive
            ? "bg-black/[0.06] text-[#1D1D1F] font-medium shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
            : "text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.5)] hover:text-[var(--color-text)]",
          collapsed && "md:justify-center md:px-2"
        )}
        title={collapsed ? item.name : undefined}
      >
        <Icon
          className={cn(
            "h-5 w-5 flex-shrink-0 transition-colors duration-200",
            isActive ? "text-primary" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]"
          )}
          strokeWidth={1.5}
        />
        {/* Mobile: always show label. Desktop: hide when collapsed */}
        <span
          className={cn(
            "transition-opacity duration-200",
            collapsed && "md:hidden"
          )}
        >
          {item.name}
        </span>
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex h-20 items-center justify-between px-4",
        collapsed && "md:px-2"
      )}>
        {/* Mobile: always show full logo with close button */}
        <div className="md:hidden flex items-center justify-between w-full">
          <Link href="/dashboard" className="flex items-center" onClick={onMobileClose}>
            <img src="/arcana-logo.png" alt="ARCANA" className="h-9" />
          </Link>
          <button
            onClick={onMobileClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.4)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[rgba(255,255,255,0.6)] transition-all duration-200 -mr-1"
            aria-label="Menue schliessen"
          >
            <X className="h-4.5 w-4.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Desktop: collapse logic */}
        <div className="hidden md:flex items-center justify-between w-full">
          <Link href="/dashboard" className={cn(
            "flex items-center transition-all duration-300",
            collapsed ? "mx-auto" : "gap-2.5"
          )}>
            {collapsed ? (
              <img src="/arcana-logo.png" alt="ARCANA" className="h-7 w-7 object-contain object-left" />
            ) : (
              <img src="/arcana-logo.png" alt="ARCANA" className="h-9" />
            )}
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
        {/* Main navigation */}
        <div className="space-y-0.5">
          {mainNavigation.map(renderNavItem)}
        </div>

        {/* Separator */}
        <div className={cn("my-3", collapsed ? "md:mx-2" : "mx-3")}>
          <div className="h-px bg-[rgba(0,0,0,0.06)]" />
        </div>

        {/* Secondary navigation */}
        <div className="space-y-0.5">
          {secondaryNavigation.map(renderNavItem)}
        </div>

        {/* Separator */}
        <div className={cn("my-3", collapsed ? "md:mx-2" : "mx-3")}>
          <div className="h-px bg-[rgba(0,0,0,0.06)]" />
        </div>

        {/* Settings */}
        <div className="space-y-0.5">
          {settingsNavigation.map(renderNavItem)}
        </div>
      </nav>

      {/* Collapse toggle button (desktop only) */}
      <div className="hidden md:flex justify-center pb-2">
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.7)] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              collapsed && "rotate-180"
            )}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* User section */}
      <div className="p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[rgba(255,255,255,0.45)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200",
            collapsed && "md:justify-center md:px-2"
          )}
        >
          {/* Gradient initials avatar */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
            {userInitials}
          </div>
          {/* Mobile: always show. Desktop: hide when collapsed */}
          <div className={cn("flex-1 min-w-0", collapsed && "md:hidden")}>
            <p className="text-sm font-medium text-[var(--color-text)] truncate">
              {session?.user?.name || "Benutzer"}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate">
              {session?.user?.email || ""}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[rgba(255,69,58,0.08)] transition-all duration-200",
              collapsed && "md:hidden"
            )}
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
        style={{
          background: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          // Base styles
          "fixed inset-y-0 left-0 z-50 flex flex-col glass-sidebar",
          // Mobile: fixed width, slide in/out with cubic-bezier
          "w-[280px] md:w-auto",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
          // Desktop: always visible, respect collapsed state
          "md:translate-x-0 md:z-30",
          collapsed ? "md:w-[72px]" : "md:w-[260px]"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
