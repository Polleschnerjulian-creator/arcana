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
  Plug,
  Repeat,
  ShoppingBag,
  Palette,
  ChevronLeft,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Notification Counts ────────────────────────────────────────

interface NotificationCounts {
  pendingDocuments: number;
  failedDocuments: number;
  unmatchedBankTransactions: number;
  overdueInvoices: number;
  draftTransactions: number;
}

function useNotificationCounts() {
  const [counts, setCounts] = React.useState<NotificationCounts | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success) {
          setCounts(json.data);
        }
      } catch {
        // Silently fail — badges are non-critical
      }
    }

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

// ─── Navigation Items ───────────────────────────────────────────

const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badgeKey: null },
  { name: "Buchungen", href: "/transactions", icon: ArrowLeftRight, badgeKey: "draftTransactions" as const },
  { name: "Belege", href: "/documents", icon: FileText, badgeKey: "documents" as const },
  { name: "Bank", href: "/bank", icon: Building2, badgeKey: "unmatchedBankTransactions" as const },
  { name: "Rechnungen", href: "/invoices", icon: Receipt, badgeKey: "overdueInvoices" as const },
];

const secondaryNavigation = [
  { name: "Berichte", href: "/reports", icon: BarChart3 },
  { name: "Kontenplan", href: "/accounts", icon: BookOpen },
  { name: "Steuer", href: "/tax", icon: Calculator },
];

const settingsNavigation = [
  { name: "Einstellungen", href: "/settings", icon: Settings },
  { name: "Rechnungsdesign", href: "/settings/invoice-design", icon: Palette },
  { name: "Dauerauftraege", href: "/settings/recurring", icon: Repeat },
  { name: "Integrationen", href: "/settings/integrations", icon: Plug },
  { name: "Shopify", href: "/settings/shopify", icon: ShoppingBag },
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
  const notificationCounts = useNotificationCounts();

  // Compute badge counts for each nav item
  function getBadgeCount(badgeKey: string | null): number {
    if (!badgeKey || !notificationCounts) return 0;
    if (badgeKey === "documents") {
      return notificationCounts.pendingDocuments + notificationCounts.failedDocuments;
    }
    if (badgeKey === "draftTransactions") return notificationCounts.draftTransactions;
    if (badgeKey === "unmatchedBankTransactions") return notificationCounts.unmatchedBankTransactions;
    if (badgeKey === "overdueInvoices") return notificationCounts.overdueInvoices;
    return 0;
  }

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

  function renderNavItem(item: { name: string; href: string; icon: LucideIcon; badgeKey?: string | null }) {
    // For /settings specifically, only match exact path (not /settings/integrations)
    const isActive = item.href === "/settings"
      ? pathname === item.href
      : pathname === item.href || pathname?.startsWith(item.href + "/");
    const Icon = item.icon;
    const badgeCount = getBadgeCount(item.badgeKey ?? null);

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
        <div className="relative flex-shrink-0">
          <Icon
            className={cn(
              "h-5 w-5 transition-colors duration-200",
              isActive ? "text-primary" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]"
            )}
            strokeWidth={1.5}
          />
          {/* Collapsed badge dot on icon */}
          {collapsed && badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 hidden md:flex h-2 w-2 rounded-full bg-red-500" />
          )}
        </div>
        {/* Mobile: always show label. Desktop: hide when collapsed */}
        <span
          className={cn(
            "flex-1 transition-opacity duration-200",
            collapsed && "md:hidden"
          )}
        >
          {item.name}
        </span>
        {/* Badge pill — visible when not collapsed */}
        {badgeCount > 0 && (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none min-w-[18px] h-[18px] px-1",
              collapsed && "md:hidden"
            )}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex h-24 items-center justify-between px-5",
        collapsed && "md:px-2"
      )}>
        {/* Mobile: always show full logo with close button */}
        <div className="md:hidden flex items-center justify-between w-full">
          <Link href="/dashboard" className="flex items-center" onClick={onMobileClose}>
            <img src="/arcana-logo.png" alt="ARCANA" className="h-14" />
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
              <img src="/arcana-logo.png" alt="ARCANA" className="h-9 w-9 object-contain object-left" />
            ) : (
              <img src="/arcana-logo.png" alt="ARCANA" className="h-14" />
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
