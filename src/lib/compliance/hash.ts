import crypto from "crypto";
import fs from "fs/promises";

/**
 * Berechnet den SHA-256-Hash eines Buffers.
 * @returns Hex-kodierter SHA-256-Hash
 */
export function computeSHA256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Liest eine Datei und berechnet deren SHA-256-Hash.
 * @returns Hex-kodierter SHA-256-Hash der Datei
 */
export async function computeSHA256FromFile(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return computeSHA256(buffer);
}
