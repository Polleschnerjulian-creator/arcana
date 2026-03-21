import fs from "fs/promises";
import path from "path";
import { computeSHA256 } from "@/lib/compliance/hash";

const STORAGE_BASE = path.join(process.cwd(), "storage", "documents");

/**
 * Speichert eine Datei im lokalen Dateisystem.
 * Erstellt ein organisationsspezifisches Verzeichnis und generiert
 * einen eindeutigen Dateinamen mit Zeitstempel.
 */
export async function saveDocument(
  file: Buffer,
  fileName: string,
  organizationId: string
): Promise<{ storagePath: string; sha256Hash: string }> {
  // Org-spezifisches Verzeichnis erstellen
  const orgDir = path.join(STORAGE_BASE, organizationId);
  await fs.mkdir(orgDir, { recursive: true });

  // Eindeutiger Dateiname: Zeitstempel + Originalname (bereinigt)
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${sanitizedName}`;
  const filePath = path.join(orgDir, uniqueName);

  // Datei schreiben
  await fs.writeFile(filePath, file);

  // SHA-256-Hash für GoBD-Konformität berechnen
  const sha256Hash = computeSHA256(file);

  // Relativer Pfad (ab storage/documents/)
  const storagePath = path.join(organizationId, uniqueName);

  return { storagePath, sha256Hash };
}

/**
 * Gibt den absoluten Pfad einer gespeicherten Datei zurück.
 */
export function getDocumentPath(storagePath: string): string {
  return path.join(STORAGE_BASE, storagePath);
}

/**
 * Löscht eine Datei aus dem lokalen Dateisystem.
 * Nur für Entwürfe / nicht verknüpfte Belege verwenden.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  const filePath = getDocumentPath(storagePath);
  await fs.unlink(filePath);
}
