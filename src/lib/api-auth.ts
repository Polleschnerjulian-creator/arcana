import crypto from "crypto";
import { prisma } from "@/lib/db";
import { computeSHA256 } from "@/lib/compliance/hash";

// ─── API Key Authentication ─────────────────────────────────────

/**
 * Authentifiziert einen API-Request anhand eines Bearer-Tokens.
 * Der Token wird als SHA-256-Hash in der Datenbank abgeglichen.
 *
 * Gibt { organizationId, keyId } zurück oder null, wenn ungültig.
 */
export async function authenticateApiKey(
  request: Request
): Promise<{ organizationId: string; keyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice(7);
  if (!key) return null;

  const keyHash = computeSHA256(Buffer.from(key));

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
  });

  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used timestamp (fire-and-forget)
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return { organizationId: apiKey.organizationId, keyId: apiKey.id };
}

// ─── API Key Generation ─────────────────────────────────────────

/**
 * Generiert einen neuen API-Schlüssel.
 * Gibt den Klartext-Schlüssel (nur einmalig!), den SHA-256-Hash
 * und das Präfix (erste 12 Zeichen) zurück.
 */
export function generateApiKey(): {
  key: string;
  keyHash: string;
  keyPrefix: string;
} {
  const bytes = crypto.randomBytes(32);
  const key = `arc_${bytes.toString("base64url")}`;
  const keyHash = computeSHA256(Buffer.from(key));
  const keyPrefix = key.slice(0, 12);
  return { key, keyHash, keyPrefix };
}
