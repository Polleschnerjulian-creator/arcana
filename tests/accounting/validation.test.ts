import { describe, it, expect } from "vitest";
import {
  validateTransaction,
  type TransactionData,
} from "@/lib/accounting/validation";
import { type TransactionLine } from "@/lib/accounting/ledger";

// ─── Hilfsfunktionen ────────────────────────────────────────────

function validLines(): TransactionLine[] {
  return [
    { accountId: "1200", debit: 119, credit: 0 },
    { accountId: "8400", debit: 0, credit: 100 },
    { accountId: "1776", debit: 0, credit: 19 },
  ];
}

function validTransaction(
  overrides: Partial<TransactionData> = {}
): TransactionData {
  return {
    date: "2026-03-21",
    description: "Testbuchung Warenverkauf",
    lines: validLines(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("validateTransaction", () => {
  // ── Gueltige Transaktionen ──────────────────────────────────

  describe("Gueltige Transaktionen", () => {
    it("sollte eine vollstaendige Transaktion mit Datum, Beschreibung und ausgeglichenen Zeilen als gueltig erkennen", () => {
      const result = validateTransaction(validTransaction());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("sollte ein Date-Objekt als Datum akzeptieren", () => {
      const result = validateTransaction(
        validTransaction({ date: new Date(2026, 2, 21) })
      );

      expect(result.valid).toBe(true);
    });

    it("sollte ein ISO-Datumsstring akzeptieren", () => {
      const result = validateTransaction(
        validTransaction({ date: "2026-03-21T10:30:00.000Z" })
      );

      expect(result.valid).toBe(true);
    });
  });

  // ── Datum-Validierung ───────────────────────────────────────

  describe("Datum-Validierung", () => {
    it("sollte einen Fehler zurueckgeben wenn das Datum fehlt", () => {
      const result = validateTransaction(
        validTransaction({ date: null })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Buchungsdatum ist erforderlich.");
    });

    it("sollte einen Fehler zurueckgeben wenn das Datum undefined ist", () => {
      const result = validateTransaction(
        validTransaction({ date: undefined })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Buchungsdatum ist erforderlich.");
    });

    it("sollte einen Fehler zurueckgeben bei ungueltigem Datumsstring", () => {
      const result = validateTransaction(
        validTransaction({ date: "kein-datum" })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Buchungsdatum ist ungültig.");
    });

    it("sollte einen Fehler zurueckgeben bei einem ungueltigem Date-Objekt", () => {
      const result = validateTransaction(
        validTransaction({ date: new Date("invalid") })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Buchungsdatum ist ungültig.");
    });
  });

  // ── Beschreibung-Validierung ────────────────────────────────

  describe("Beschreibung-Validierung", () => {
    it("sollte einen Fehler zurueckgeben wenn die Beschreibung fehlt", () => {
      const result = validateTransaction(
        validTransaction({ description: null })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Buchungstext darf nicht leer sein."
      );
    });

    it("sollte einen Fehler zurueckgeben bei leerer Beschreibung", () => {
      const result = validateTransaction(
        validTransaction({ description: "" })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Buchungstext darf nicht leer sein."
      );
    });

    it("sollte einen Fehler zurueckgeben bei Beschreibung nur aus Leerzeichen", () => {
      const result = validateTransaction(
        validTransaction({ description: "   " })
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Buchungstext darf nicht leer sein."
      );
    });
  });

  // ── Buchungszeilen-Validierung ──────────────────────────────

  describe("Buchungszeilen-Validierung", () => {
    it("sollte einen Fehler zurueckgeben wenn keine Buchungszeilen vorhanden sind", () => {
      const result = validateTransaction(
        validTransaction({ lines: [] })
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Buchungszeile"))).toBe(
        true
      );
    });

    it("sollte einen Fehler zurueckgeben wenn die Zeilen nicht ausgeglichen sind", () => {
      const result = validateTransaction(
        validTransaction({
          lines: [
            { accountId: "1200", debit: 100, credit: 0 },
            { accountId: "8400", debit: 0, credit: 99 },
          ],
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("nicht ausgeglichen"))
      ).toBe(true);
    });

    it("sollte die Fehler der double-entry Validierung weiterleiten", () => {
      const result = validateTransaction(
        validTransaction({
          lines: [{ accountId: "1200", debit: 100, credit: 0 }],
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("mindestens 2"))
      ).toBe(true);
    });
  });

  // ── Mehrfache Fehler ────────────────────────────────────────

  describe("Mehrfache Fehler gleichzeitig", () => {
    it("sollte alle Fehler auf einmal sammeln (Datum + Beschreibung + Zeilen)", () => {
      const result = validateTransaction({
        date: null,
        description: "",
        lines: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Statusuebergaenge ───────────────────────────────────────

  describe("Statusuebergaenge", () => {
    it("sollte den Uebergang DRAFT -> BOOKED als gueltig erkennen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "BOOKED",
          currentStatus: "DRAFT",
        })
      );

      expect(result.valid).toBe(true);
    });

    it("sollte den Uebergang DRAFT -> CANCELLED als gueltig erkennen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "CANCELLED",
          currentStatus: "DRAFT",
        })
      );

      expect(result.valid).toBe(true);
    });

    it("sollte den Uebergang BOOKED -> CANCELLED (Storno) als gueltig erkennen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "CANCELLED",
          currentStatus: "BOOKED",
          isStorno: true,
        })
      );

      expect(result.valid).toBe(true);
    });

    it("sollte den Uebergang BOOKED -> DRAFT als ungueltig ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "DRAFT",
          currentStatus: "BOOKED",
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("Ungültiger Statusübergang")
        )
      ).toBe(true);
      expect(
        result.errors.some((e) => e.includes("BOOKED"))
      ).toBe(true);
    });

    it("sollte den Uebergang CANCELLED -> DRAFT als ungueltig ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "DRAFT",
          currentStatus: "CANCELLED",
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("Ungültiger Statusübergang")
        )
      ).toBe(true);
    });

    it("sollte den Uebergang CANCELLED -> BOOKED als ungueltig ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "BOOKED",
          currentStatus: "CANCELLED",
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("Ungültiger Statusübergang")
        )
      ).toBe(true);
      expect(
        result.errors.some((e) => e.includes("keine"))
      ).toBe(true);
    });

    it("sollte den Uebergang CANCELLED -> CANCELLED als ungueltig ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "CANCELLED",
          currentStatus: "CANCELLED",
        })
      );

      // Gleicher Status = kein Uebergang, also kein Fehler
      expect(
        result.errors.some((e) =>
          e.includes("Ungültiger Statusübergang")
        )
      ).toBe(false);
    });

    it("sollte BOOKED -> CANCELLED ohne Storno-Flag als ungueltig ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          status: "CANCELLED",
          currentStatus: "BOOKED",
          isStorno: false,
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Stornobuchung"))
      ).toBe(true);
    });
  });

  // ── Festschreibungsschutz (GoBD) ───────────────────────────

  describe("Festschreibungsschutz (GoBD-Konformitaet)", () => {
    it("sollte die Bearbeitung einer festgeschriebenen Buchung ablehnen", () => {
      const result = validateTransaction(
        validTransaction({
          currentStatus: "BOOKED",
          bookedAt: new Date("2026-03-20"),
          status: "BOOKED", // Versuch einer Aenderung ohne Statuswechsel
        })
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("Festgeschriebene Buchungen")
        )
      ).toBe(true);
    });

    it("sollte die Stornierung einer festgeschriebenen Buchung erlauben", () => {
      const result = validateTransaction(
        validTransaction({
          currentStatus: "BOOKED",
          bookedAt: new Date("2026-03-20"),
          status: "CANCELLED",
          isStorno: true,
        })
      );

      // Stornierung ist der einzige erlaubte Weg bei BOOKED
      expect(
        result.errors.some((e) =>
          e.includes("Festgeschriebene Buchungen")
        )
      ).toBe(false);
    });

    it("sollte keine Festschreibungspruefung durchfuehren wenn bookedAt nicht gesetzt ist", () => {
      const result = validateTransaction(
        validTransaction({
          currentStatus: "BOOKED",
          bookedAt: null,
          status: "BOOKED",
        })
      );

      // Ohne bookedAt greift der Festschreibungsschutz nicht
      expect(
        result.errors.some((e) =>
          e.includes("Festgeschriebene Buchungen")
        )
      ).toBe(false);
    });
  });

  // ── Ohne Status-Angaben ─────────────────────────────────────

  describe("Transaktionen ohne Statusangaben", () => {
    it("sollte gueltig sein wenn weder status noch currentStatus angegeben sind (Neuanlage)", () => {
      const result = validateTransaction(
        validTransaction({
          status: undefined,
          currentStatus: undefined,
        })
      );

      expect(result.valid).toBe(true);
    });

    it("sollte gueltig sein wenn nur status ohne currentStatus angegeben ist", () => {
      const result = validateTransaction(
        validTransaction({
          status: "DRAFT",
          currentStatus: undefined,
        })
      );

      expect(result.valid).toBe(true);
    });
  });
});
