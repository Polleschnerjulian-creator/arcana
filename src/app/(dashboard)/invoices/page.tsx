import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Send, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { InvoiceList } from "@/components/invoices/invoice-list";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      transaction: {
        select: { id: true, status: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // Serialize for client component
  const serialized = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customerName,
    customerAddress: inv.customerAddress,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    status: inv.status as
      | "DRAFT"
      | "SENT"
      | "PAID"
      | "OVERDUE"
      | "CANCELLED",
    lineItems: inv.lineItems,
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    total: Number(inv.total),
    transactionId: inv.transactionId,
    createdAt: inv.createdAt.toISOString(),
  }));

  // Stats
  const totalCount = serialized.length;
  const draftCount = serialized.filter((i) => i.status === "DRAFT").length;
  const sentCount = serialized.filter((i) => i.status === "SENT").length;
  const paidCount = serialized.filter((i) => i.status === "PAID").length;
  const overdueCount = serialized.filter((i) => i.status === "OVERDUE").length;
  const outstandingAmount = serialized
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.total, 0);

  const stats = [
    {
      label: "Gesamt",
      value: totalCount.toString(),
      icon: FileText,
      color: "text-[var(--color-text-secondary)]",
      bgColor: "bg-black/[0.04]",
    },
    {
      label: "Entwürfe",
      value: draftCount.toString(),
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Versendet",
      value: sentCount.toString(),
      icon: Send,
      color: "text-sky-600",
      bgColor: "bg-sky-500/10",
    },
    {
      label: "Bezahlt",
      value: paidCount.toString(),
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Rechnungen
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Ausgangsrechnungen erstellen, versenden und verfolgen
          </p>
        </div>
        <Link href="/invoices/new">
          <Button size="md">
            <Plus className="h-4 w-4" />
            Neue Rechnung
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bgColor}`}
            >
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-semibold text-text-primary">
                {stat.value}
              </p>
              <p className="text-xs text-text-secondary">{stat.label}</p>
            </div>
          </div>
        ))}

        {/* Outstanding amount */}
        <div className="glass rounded-2xl p-4 flex items-center gap-3 col-span-2 sm:col-span-4 lg:col-span-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.04]">
            <FileText className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </div>
          <div>
            <p className="text-xl font-semibold text-text-primary font-mono tabular-nums">
              {formatCurrency(outstandingAmount)}
            </p>
            <p className="text-xs text-text-secondary">
              Ausstehend{overdueCount > 0 && ` (${overdueCount} überfällig)`}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <InvoiceList invoices={serialized} />
    </div>
  );
}
