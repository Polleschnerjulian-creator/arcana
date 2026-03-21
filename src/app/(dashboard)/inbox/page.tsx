import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxStream } from "@/components/inbox/inbox-stream";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          Eingangskorb
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Alle offenen Posten an einem Ort — bestätigen, bearbeiten oder überspringen.
        </p>
      </div>

      <InboxStream />
    </div>
  );
}
