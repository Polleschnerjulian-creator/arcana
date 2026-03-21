import Link from "next/link";
import { DocumentUpload } from "@/components/documents/document-upload";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/documents"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Zurück zur Übersicht
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary mt-2">
          Belege hochladen
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Laden Sie Rechnungen, Quittungen oder Kontoauszüge hoch. Unterstützte
          Formate: PDF, JPG, PNG, WebP.
        </p>
      </div>

      <DocumentUpload />
    </div>
  );
}
