"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ChatPanel } from "@/components/chat/chat-panel";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const [animateKey, setAnimateKey] = React.useState(pathname);

  const handleMobileClose = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleMobileToggle = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Trigger content animation on route change
  React.useEffect(() => {
    setAnimateKey(pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
      <Header
        collapsed={collapsed}
        onMobileMenuToggle={handleMobileToggle}
      />
      <main
        className={cn(
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Desktop: offset by sidebar width
          collapsed ? "md:ml-[72px]" : "md:ml-[260px]",
          // Mobile: no offset
          "ml-0"
        )}
      >
        <div
          key={animateKey}
          className="p-4 md:p-6 animate-in"
        >
          {children}
        </div>
      </main>
      <ChatPanel />
    </div>
  );
}
