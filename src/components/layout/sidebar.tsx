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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Buchungen", href: "/transactions", icon: ArrowLeftRight },
  { name: "Belege", href: "/documents", icon: FileText },
  { name: "Bank", href: "/bank", icon: Building2 },
  { name: "Rechnungen", href: "/invoices", icon: Receipt },
  { name: "Berichte", href: "/reports", icon: BarChart3 },
  { name: "Kontenplan", href: "/accounts", icon: BookOpen },
  { name: "Steuer", href: "/tax", icon: Calculator },
  { name: "Einstellungen", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
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
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface transition-all duration-200",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
              A
            </div>
            <span className="text-lg font-semibold tracking-tight text-text-primary">
              ARCANA
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
              A
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
            aria-label="Sidebar einklappen"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
            aria-label="Sidebar ausklappen"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary"
                  : "text-text-secondary hover:bg-gray-50 hover:text-text-primary",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-primary" : "text-text-muted"
                )}
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-primary text-xs font-semibold">
            {userInitials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {session?.user?.name || "Benutzer"}
              </p>
              <p className="text-xs text-text-muted truncate">
                {session?.user?.email || ""}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-danger hover:bg-danger-light transition-colors"
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
