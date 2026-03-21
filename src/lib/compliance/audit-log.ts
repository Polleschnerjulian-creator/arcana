import crypto from "crypto";
import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "BOOK"
  | "CANCEL"
  | "DELETE"
  | "EXPORT"
  | "LOGIN";

export type EntityType =
  | "TRANSACTION"
  | "DOCUMENT"
  | "ACCOUNT"
  | "BANK_ACCOUNT"
  | "BANK_TRANSACTION"
  | "INVOICE"
  | "TAX_PERIOD"
  | "USER"
  | "ORGANIZATION";

export interface CreateAuditEntryParams {
  organizationId: string;
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
}

// ─── Hash-Chain Computation ──────────────────────────────────────

function computeHashChain(
  previousHash: string | null,
  data: {
    action: string;
    entityType: string;
    entityId: string;
    timestamp: string;
    newState?: string | null;
  }
): string {
  const payload = JSON.stringify(data);
  const input = previousHash ? previousHash + payload : payload;
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ─── Main Function ───────────────────────────────────────────────

/**
 * Erstellt einen GoBD-konformen, unveränderlichen Audit-Log-Eintrag
 * mit verketteter SHA-256-Hashkette.
 *
 * Diese Funktion wirft NIEMALS einen Fehler — Fehler werden
 * geloggt, aber der aufrufende Code wird nicht unterbrochen.
 */
export async function createAuditEntry(
  params: CreateAuditEntryParams
): Promise<
  | {
      id: string;
      organizationId: string;
      timestamp: Date;
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      previousState: string | null;
      newState: string | null;
      hashChain: string;
    }
  | undefined
> {
  try {
    const {
      organizationId,
      userId,
      action,
      entityType,
      entityId,
      previousState,
      newState,
    } = params;

    const serializedNewState = newState ? JSON.stringify(newState) : null;
    const serializedPreviousState = previousState
      ? JSON.stringify(previousState)
      : null;

    // Atomare Transaktion: findFirst + create verhindert Race Conditions
    const entry = await prisma.$transaction(async (tx) => {
      // Letzten Audit-Log-Eintrag dieser Organisation abrufen
      const lastEntry = await tx.auditLog.findFirst({
        where: { organizationId },
        orderBy: { timestamp: "desc" },
        select: { hashChain: true },
      });

      const timestamp = new Date();

      // Hash-Kette berechnen
      const hashChain = computeHashChain(
        lastEntry?.hashChain ?? null,
        {
          action,
          entityType,
          entityId,
          timestamp: timestamp.toISOString(),
          newState: serializedNewState,
        }
      );

      // Audit-Log-Eintrag erstellen
      return tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          entityType,
          entityId,
          previousState: serializedPreviousState,
          newState: serializedNewState,
          hashChain,
          timestamp,
        },
      });
    });

    return entry;
  } catch (error) {
    // [GoBD AUDIT FAILURE] — Prefix für Log-Drain-Suche und Alerting.
    // In Produktion sollte dieser Fehler einen Alert auslösen,
    // da fehlgeschlagene Audit-Einträge die GoBD-Konformität gefährden.
    console.error("[GoBD AUDIT FAILURE]", {
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
