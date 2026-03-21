import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewInvoicePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      legalForm: true,
      taxId: true,
      ustId: true,
      street: true,
      city: true,
      zip: true,
      country: true,
    },
  });

  if (!organization) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Neue Rechnung
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Erstellen Sie eine neue Ausgangsrechnung
        </p>
      </div>

      <InvoiceForm
        organization={{
          name: organization.name,
          legalForm: organization.legalForm,
          street: organization.street,
          city: organization.city,
          zip: organization.zip,
        }}
      />
    </div>
  );
}
