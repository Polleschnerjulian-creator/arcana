"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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

  return (
    <div className="min-h-screen bg-background">
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
          "transition-all duration-200",
          // Desktop: offset by sidebar width
          collapsed ? "md:ml-[72px]" : "md:ml-[260px]",
          // Mobile: no offset
          "ml-0"
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
