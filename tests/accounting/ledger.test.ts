import { describe, it, expect } from "vitest";
import {
  validateDoubleEntry,
  type TransactionLine,
} from "@/lib/accounting/ledger";

// ─── Hilfsfunktion ──────────────────────────────────────────────

function line(
  accountId: string,
  debit: number,
  credit: number
): TransactionLine {
  return { accountId, debit, credit };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("validateDoubleEntry", () => {
  // ── Gueltige Buchungen ────────────────────────────────────────

  describe("Gueltige Buchungssaetze", () => {
    it("sollte eine einfache 2-Zeilen-Buchung (Soll = Haben) als gueltig erkennen", () => {
      const result = validateDoubleEntry([
        line("1000", 100, 0),
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("sollte eine 3-Zeilen-Buchung mit Steuersplit als gueltig erkennen", () => {
      // Bruttobuchung mit 19% USt: Netto 100 + USt 19 = Brutto 119
      const result = validateDoubleEntry([
        line("1200", 119, 0), // Bank (Soll)
        line("8400", 0, 100), // Erloese (Haben)
        line("1776", 0, 19), // USt 19% (Haben)
      ]);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("sollte eine Buchung mit vielen Zeilen (10+) als gueltig erkennen wenn ausgeglichen", () => {
      const lines: TransactionLine[] = [];
      // 10 Soll-Zeilen je 10 EUR
      for (let i = 0; i < 10; i++) {
        lines.push(line(`400${i}`, 10, 0));
      }
      // 1 Haben-Zeile mit 100 EUR
      lines.push(line("1200", 0, 100));

      const result = validateDoubleEntry(lines);
      expect(result.valid).toBe(true);
    });

    it("sollte eine Buchung mit sehr grossen Betraegen (999.999,99) als gueltig erkennen", () => {
      const result = validateDoubleEntry([
        line("1200", 999999.99, 0),
        line("8400", 0, 999999.99),
      ]);

      expect(result.valid).toBe(true);
    });

    it("sollte eine Buchung mit sehr kleinen Betraegen (0,01) als gueltig erkennen", () => {
      const result = validateDoubleEntry([
        line("1200", 0.01, 0),
        line("8400", 0, 0.01),
      ]);

      expect(result.valid).toBe(true);
    });

    it("sollte Buchungen mit ganzen Euro-Betraegen als gueltig erkennen", () => {
      const result = validateDoubleEntry([
        line("1200", 500, 0),
        line("8400", 0, 500),
      ]);

      expect(result.valid).toBe(true);
    });

    it("sollte eine komplexe Buchung mit mehreren Soll- und Haben-Zeilen als gueltig erkennen", () => {
      const result = validateDoubleEntry([
        line("4200", 300, 0), // Miete
        line("4210", 200, 0), // Nebenkosten
        line("1576", 95, 0), // Vorsteuer
        line("1200", 0, 595), // Bank
      ]);

      expect(result.valid).toBe(true);
    });
  });

  // ── Ungueltige Buchungen ──────────────────────────────────────

  describe("Ungueltige Buchungssaetze", () => {
    it("sollte einen Fehler zurueckgeben wenn Soll und Haben nicht ausgeglichen sind", () => {
      const result = validateDoubleEntry([
        line("1200", 100, 0),
        line("8400", 0, 99),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("nicht ausgeglichen");
    });

    it("sollte einen Fehler zurueckgeben bei nur 1 Buchungszeile", () => {
      const result = validateDoubleEntry([line("1200", 100, 0)]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("mindestens 2 Buchungszeilen");
    });

    it("sollte einen Fehler zurueckgeben bei leerem Array", () => {
      const result = validateDoubleEntry([]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("mindestens 2 Buchungszeilen");
    });

    it("sollte einen Fehler zurueckgeben bei null/undefined Eingabe", () => {
      const result = validateDoubleEntry(
        null as unknown as TransactionLine[]
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("mindestens 2 Buchungszeilen");
    });

    it("sollte einen Fehler zurueckgeben wenn eine Zeile sowohl Soll als auch Haben > 0 hat", () => {
      const result = validateDoubleEntry([
        line("1200", 100, 50), // Ungueltig: beides > 0
        line("8400", 0, 50),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        "nicht gleichzeitig Soll und Haben"
      );
    });

    it("sollte einen Fehler zurueckgeben wenn eine Zeile Soll = 0 UND Haben = 0 hat", () => {
      const result = validateDoubleEntry([
        line("1200", 0, 0), // Ungueltig: beides 0
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        "Entweder Soll oder Haben muss gr"
      );
    });

    it("sollte einen Fehler zurueckgeben bei negativem Soll-Betrag", () => {
      const result = validateDoubleEntry([
        line("1200", -100, 0),
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("nicht negativ");
    });

    it("sollte einen Fehler zurueckgeben bei negativem Haben-Betrag", () => {
      const result = validateDoubleEntry([
        line("1200", 100, 0),
        line("8400", 0, -100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("nicht negativ");
    });

    it("sollte einen Fehler zurueckgeben wenn accountId fehlt", () => {
      const result = validateDoubleEntry([
        { accountId: "", debit: 100, credit: 0 },
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Konto-ID ist erforderlich");
    });

    it("sollte einen Fehler zurueckgeben bei nicht-numerischen Betraegen", () => {
      const result = validateDoubleEntry([
        {
          accountId: "1200",
          debit: "abc" as unknown as number,
          credit: 0,
        },
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("numerische Werte");
    });

    it("sollte einen Fehler zurueckgeben bei NaN-Betraegen", () => {
      const result = validateDoubleEntry([
        line("1200", NaN, 0),
        line("8400", 0, 100),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("NaN");
    });
  });

  // ── Gleitkomma-Praezision ─────────────────────────────────────

  describe("Gleitkomma-Praezision und Rundung", () => {
    it("sollte 0,1 + 0,2 korrekt als 0,3 behandeln (Floating-Point)", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const result = validateDoubleEntry([
        line("4000", 0.1, 0),
        line("4001", 0.2, 0),
        line("1200", 0, 0.3),
      ]);

      expect(result.valid).toBe(true);
    });

    it("sollte Betraege mit mehr als 2 Nachkommastellen korrekt runden", () => {
      // 33.333 + 33.333 + 33.334 = 100.000
      // Gerundet: 33.33 + 33.33 + 33.33 = 99.99 vs 100.00
      // Die Funktion rundet die Summen, daher muss die Buchung exakt sein
      const result = validateDoubleEntry([
        line("4000", 50.005, 0), // rundet auf 50.01
        line("4001", 49.995, 0), // rundet auf 50.00
        line("1200", 0, 100.00),
      ]);

      // Die roundCurrency-Funktion rundet die Summe, also:
      // sum debit = 50.005 + 49.995 = 100.0 -> 100.00
      // sum credit = 100.00
      expect(result.valid).toBe(true);
    });

    it("sollte bei Differenz nach Rundung trotzdem korrekt pruefen", () => {
      // Soll: 33.33 + 33.33 + 33.33 = 99.99
      // Haben: 100.00
      // Differenz nach Rundung: 0.01
      const result = validateDoubleEntry([
        line("4000", 33.33, 0),
        line("4001", 33.33, 0),
        line("4002", 33.33, 0),
        line("1200", 0, 100.0),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("nicht ausgeglichen");
    });

    it("sollte eine typische Steuersplit-Buchung mit Centbetraegen als gueltig erkennen", () => {
      // Brutto 10,50 EUR mit 19% USt
      // Netto = 10.50 / 1.19 = 8.823529... -> gerundet 8.82
      // Steuer = 10.50 - 8.82 = 1.68
      const result = validateDoubleEntry([
        line("1200", 10.5, 0),
        line("8400", 0, 8.82),
        line("1776", 0, 1.68),
      ]);

      expect(result.valid).toBe(true);
    });

    it("sollte die Fehlermeldung mit korrekten Waehrungsbetraegen anzeigen", () => {
      const result = validateDoubleEntry([
        line("1200", 1234.56, 0),
        line("8400", 0, 1234.55),
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Differenz");
    });
  });

  // ── Zeilennummern in Fehlermeldungen ──────────────────────────

  describe("Fehlermeldungen mit Zeilennummern", () => {
    it("sollte die korrekte Zeilennummer bei einem Fehler in Zeile 1 anzeigen", () => {
      const result = validateDoubleEntry([
        line("1200", 0, 0), // Zeile 1: Fehler
        line("8400", 0, 100),
      ]);

      expect(result.error).toContain("Zeile 1");
    });

    it("sollte die korrekte Zeilennummer bei einem Fehler in Zeile 2 anzeigen", () => {
      const result = validateDoubleEntry([
        line("1200", 100, 0),
        line("8400", -50, 0), // Zeile 2: Fehler
      ]);

      expect(result.error).toContain("Zeile 2");
    });

    it("sollte die korrekte Zeilennummer bei einem Fehler in spaeterer Zeile anzeigen", () => {
      const result = validateDoubleEntry([
        line("1200", 50, 0),
        line("4000", 25, 0),
        line("4001", 25, 0),
        line("", 0, 100), // Zeile 4: fehlende accountId
      ]);

      expect(result.error).toContain("Zeile 4");
    });
  });
});
