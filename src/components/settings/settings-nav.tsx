"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  User,
  Palette,
  Repeat,
  Plug,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ─── Navigation Structure ────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Allgemein",
    items: [
      { name: "Unternehmen", href: "/settings", icon: Building2 },
      { name: "Benutzer", href: "/settings/profile", icon: User },
    ],
  },
  {
    label: "Rechnungen",
    items: [
      { name: "Rechnungsdesign", href: "/settings/invoice-design", icon: Palette },
      { name: "Dauerauftraege", href: "/settings/recurring", icon: Repeat },
    ],
  },
  {
    label: "Integrationen",
    items: [
      { name: "API & Webhooks", href: "/settings/integrations", icon: Plug },
      { name: "Shopify", href: "/settings/shopify", icon: ShoppingBag },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────

export function SettingsNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/settings") {
      return pathname === "/settings";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:block w-56 shrink-0">
        <div
          className={cn(
            "sticky top-6 rounded-2xl p-2",
            "bg-[rgba(255,255,255,0.45)] backdrop-blur-2xl",
            "border border-[rgba(255,255,255,0.5)]",
            "shadow-[0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.03)]"
          )}
        >
          {sections.map((section, idx) => (
            <div key={section.label}>
              {idx > 0 && (
                <div className="mx-2 my-1.5">
                  <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                </div>
              )}
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {section.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200 ease-out",
                        active
                          ? "bg-black/[0.06] text-[#1D1D1F] font-medium shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.5)] hover:text-[var(--color-text)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-colors duration-200",
                          active
                            ? "text-[#1D1D1F]"
                            : "text-[var(--color-text-tertiary)]"
                        )}
                        strokeWidth={1.5}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile: horizontal scrolling tabs */}
      <nav className="md:hidden -mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 pb-2 min-w-max">
          {sections.flatMap((section) =>
            section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs whitespace-nowrap transition-all duration-200",
                    active
                      ? "bg-black/[0.06] text-[#1D1D1F] font-medium shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.4)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {item.name}
                </Link>
              );
            })
          )}
        </div>
      </nav>
    </>
  );
}
