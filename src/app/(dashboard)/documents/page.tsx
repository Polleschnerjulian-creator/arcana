import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentReviewList } from "@/components/documents/document-review-list";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  // Fetch all documents for the list
  const documents = await prisma.document.findMany({
    where: { organizationId },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  // Fetch documents needing review (pipeline complete with DRAFT, or failed states)
  const reviewDocuments = await prisma.document.findMany({
    where: {
      organizationId,
      OR: [
        // Pipeline complete with DRAFT transaction
        {
          ocrStatus: "DONE",
          aiExtraction: { not: null },
          transactions: {
            some: { status: "DRAFT" },
          },
        },
        // OCR done but AI extraction failed
        {
          ocrStatus: "DONE",
          aiExtraction: null,
        },
        // OCR failed
        {
          ocrStatus: "FAILED",
        },
        // Pipeline still running
        {
          ocrStatus: { in: ["PENDING", "PROCESSING"] },
        },
      ],
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
      transactions: {
        where: { status: "DRAFT" },
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, number: true, name: true, type: true },
              },
            },
          },
        },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  // Serialize documents for the list
  const serialized = documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    type: doc.type as
      | "INCOMING_INVOICE"
      | "OUTGOING_INVOICE"
      | "RECEIPT"
      | "BANK_STATEMENT"
      | "OTHER",
    ocrStatus: doc.ocrStatus as "PENDING" | "PROCESSING" | "DONE" | "FAILED",
    aiExtraction: doc.aiExtraction,
    sha256Hash: doc.sha256Hash,
    uploadedAt: doc.uploadedAt.toISOString(),
    uploadedBy: doc.uploadedBy,
  }));

  // Serialize review documents
  const reviewSerialized = reviewDocuments.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    type: doc.type,
    ocrStatus: doc.ocrStatus,
    aiExtraction: doc.aiExtraction,
    uploadedAt: doc.uploadedAt.toISOString(),
    uploadedBy: doc.uploadedBy,
    transaction: doc.transactions[0]
      ? {
          id: doc.transactions[0].id,
          date: doc.transactions[0].date.toISOString(),
          description: doc.transactions[0].description,
          reference: doc.transactions[0].reference,
          status: doc.transactions[0].status,
          aiConfidence: doc.transactions[0].aiConfidence,
          lines: doc.transactions[0].lines.map((line) => ({
            id: line.id,
            accountId: line.accountId,
            debit: Number(line.debit),
            credit: Number(line.credit),
            taxRate: line.taxRate,
            note: line.note,
            account: line.account,
          })),
        }
      : null,
  }));

  // Stats
  const totalCount = serialized.length;
  const pendingCount = serialized.filter(
    (d) => d.ocrStatus === "PENDING"
  ).length;
  const processingCount = serialized.filter(
    (d) => d.ocrStatus === "PROCESSING"
  ).length;
  const doneCount = serialized.filter((d) => d.ocrStatus === "DONE").length;
  const failedCount = serialized.filter(
    (d) => d.ocrStatus === "FAILED"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Belege</h1>
          <p className="text-sm text-text-secondary mt-1">
            {totalCount} gesamt &middot; {pendingCount} ausstehend &middot;{" "}
            {processingCount + doneCount} verarbeitet &middot; {failedCount}{" "}
            fehlgeschlagen
          </p>
        </div>
        <Link
          href="/documents/upload"
          className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg bg-primary text-white hover:bg-primary-hover active:bg-primary-hover h-10 px-4 text-sm gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Belege hochladen
        </Link>
      </div>

      {/* Review Section */}
      {reviewSerialized.length > 0 && (
        <DocumentReviewList documents={reviewSerialized} />
      )}

      {/* All Documents */}
      <DocumentList documents={serialized} />
    </div>
  );
}
