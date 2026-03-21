import { validateDoubleEntry, type TransactionLine } from "./ledger";

// ─── Types ───────────────────────────────────────────────────────

export type TransactionStatus = "DRAFT" | "BOOKED" | "CANCELLED";

export interface TransactionData {
  date?: string | Date | null;
  description?: string | null;
  lines: TransactionLine[];
  status?: TransactionStatus;
  currentStatus?: TransactionStatus; // Der aktuelle Status in der DB
  bookedAt?: Date | string | null; // Festschreibungszeitpunkt
  isStorno?: boolean; // Ist dies eine Stornobuchung?
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Valid Status Transitions ────────────────────────────────────

const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  DRAFT: ["BOOKED", "CANCELLED"],
  BOOKED: ["CANCELLED"], // Nur via Stornobuchung
  CANCELLED: [], // Endstatus — keine weiteren Übergänge
};

// ─── Main Validation ─────────────────────────────────────────────

/**
 * Validiert eine vollständige Transaktion vor dem Speichern.
 *
 * Prüft:
 * - Datum ist vorhanden und gültig
 * - Beschreibung ist nicht leer
 * - Buchungszeilen bestehen die doppelte Buchführungsprüfung
 * - Statusübergänge sind gültig
 * - Festgeschriebene Buchungen (BOOKED) können nicht bearbeitet werden
 */
export function validateTransaction(data: TransactionData): ValidationResult {
  const errors: string[] = [];

  // ── Datum validieren ───────────────────────────────────────────
  if (!data.date) {
    errors.push("Buchungsdatum ist erforderlich.");
  } else {
    const dateObj =
      data.date instanceof Date ? data.date : new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      errors.push("Buchungsdatum ist ungültig.");
    }
  }

  // ── Beschreibung validieren ────────────────────────────────────
  if (!data.description || data.description.trim().length === 0) {
    errors.push("Buchungstext darf nicht leer sein.");
  }

  // ── Buchungszeilen validieren ──────────────────────────────────
  if (!data.lines || data.lines.length === 0) {
    errors.push("Mindestens eine Buchungszeile ist erforderlich.");
  } else {
    const doubleEntryResult = validateDoubleEntry(data.lines);
    if (!doubleEntryResult.valid && doubleEntryResult.error) {
      errors.push(doubleEntryResult.error);
    }
  }

  // ── Festschreibungsschutz ──────────────────────────────────────
  // Wenn die Buchung bereits festgeschrieben ist, darf sie nicht
  // mehr bearbeitet werden (GoBD-Konformität).
  if (data.bookedAt && data.currentStatus === "BOOKED") {
    // Nur Stornierung ist erlaubt, keine inhaltliche Änderung
    if (data.status !== "CANCELLED") {
      errors.push(
        "Festgeschriebene Buchungen (BOOKED) können nicht mehr bearbeitet werden. " +
          "Änderungen sind nur durch eine Stornobuchung möglich."
      );
    }
  }

  // ── Statusübergänge validieren ─────────────────────────────────
  if (data.status && data.currentStatus) {
    if (data.status !== data.currentStatus) {
      const allowedTransitions = VALID_TRANSITIONS[data.currentStatus];

      if (!allowedTransitions.includes(data.status)) {
        errors.push(
          `Ungültiger Statusübergang: ${data.currentStatus} → ${data.status}. ` +
            `Erlaubte Übergänge von ${data.currentStatus}: ${allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "keine"}.`
        );
      }

      // BOOKED -> CANCELLED ist nur via Storno erlaubt
      if (
        data.currentStatus === "BOOKED" &&
        data.status === "CANCELLED" &&
        !data.isStorno
      ) {
        errors.push(
          "Eine festgeschriebene Buchung kann nur durch eine Stornobuchung storniert werden."
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
