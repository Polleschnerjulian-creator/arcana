"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header collapsed={collapsed} />
      <main
        className={cn(
          "transition-all duration-200",
          collapsed ? "ml-[72px]" : "ml-[260px]"
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
