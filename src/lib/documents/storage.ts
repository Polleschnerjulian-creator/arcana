import { put, del } from "@vercel/blob";
import { computeSHA256 } from "@/lib/compliance/hash";

/**
 * Speichert eine Datei in Vercel Blob Storage.
 * Erstellt einen organisationsspezifischen Pfad und generiert
 * einen eindeutigen Dateinamen mit Zeitstempel.
 *
 * Benötigt die Umgebungsvariable BLOB_READ_WRITE_TOKEN auf Vercel.
 */
export async function saveDocument(
  file: Buffer,
  fileName: string,
  organizationId: string
): Promise<{ storagePath: string; sha256Hash: string }> {
  // SHA-256-Hash für GoBD-Konformität berechnen
  const sha256Hash = computeSHA256(file);

  const blobPath = `documents/${organizationId}/${Date.now()}-${fileName}`;

  const blob = await put(blobPath, file, {
    access: "public",
    contentType: getMimeType(fileName),
  });

  return {
    storagePath: blob.url, // Blob-URL als storagePath speichern
    sha256Hash,
  };
}

/**
 * Gibt die URL eines gespeicherten Dokuments zurück.
 * storagePath ist jetzt direkt die Vercel Blob URL.
 */
export function getDocumentUrl(storagePath: string): string {
  return storagePath;
}

/**
 * Löscht eine Datei aus dem Vercel Blob Storage.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  await del(storagePath);
}

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
