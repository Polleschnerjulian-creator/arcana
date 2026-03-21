import { put, del } from "@vercel/blob";
import { computeSHA256 } from "@/lib/compliance/hash";
import crypto from "crypto";

/**
 * Speichert eine Datei in Vercel Blob Storage.
 * Erstellt einen organisationsspezifischen Pfad und generiert
 * einen eindeutigen Dateinamen mit kryptographisch zufälligem Präfix
 * (statt vorhersehbarem Zeitstempel), um URLs unratbar zu machen.
 *
 * WICHTIG: Die Blob-URL wird in der DB gespeichert, aber NIEMALS
 * direkt an den Client weitergegeben. Dateien werden ausschließlich
 * über die authentifizierte API-Route /api/documents/[id]/file ausgeliefert.
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

  // Use crypto-random prefix instead of predictable Date.now()
  const randomPrefix = crypto.randomBytes(16).toString("hex");
  const blobPath = `documents/${organizationId}/${randomPrefix}-${fileName}`;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN ist nicht konfiguriert. Bitte in den Vercel Einstellungen setzen.");
  }

  const blob = await put(blobPath, file, {
    access: "public",
    contentType: getMimeType(fileName),
    token,
  });

  return {
    storagePath: blob.url, // Blob-URL als storagePath speichern
    sha256Hash,
  };
}

/**
 * Gibt die interne Blob-URL eines gespeicherten Dokuments zurück.
 * WICHTIG: Diese URL darf NICHT direkt an den Client weitergegeben werden.
 * Clients müssen über /api/documents/[id]/file zugreifen (authentifiziert).
 */
export function getDocumentUrl(storagePath: string): string {
  return storagePath;
}

/**
 * Löscht eine Datei aus dem Vercel Blob Storage.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN nicht konfiguriert.");
  await del(storagePath, { token });
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
