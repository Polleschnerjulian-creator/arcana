import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── formatCurrency ─────────────────────────────────────────────

describe("formatCurrency", () => {
  describe("Standard-Betraege", () => {
    it("sollte 1234,56 EUR korrekt als deutsche Waehrung formatieren", () => {
      const result = formatCurrency(1234.56);

      // Intl.NumberFormat verwendet verschiedene Leerzeichen (NBSP)
      // Daher pruefen wir die wesentlichen Bestandteile
      expect(result).toContain("1.234,56");
      expect(result).toContain("€");
    });

    it("sollte 0 EUR korrekt formatieren", () => {
      const result = formatCurrency(0);

      expect(result).toContain("0,00");
      expect(result).toContain("€");
    });

    it("sollte negative Betraege korrekt formatieren", () => {
      const result = formatCurrency(-500);

      expect(result).toContain("500,00");
      expect(result).toContain("€");
      // Muss ein Minuszeichen oder das Unicode-Minuszeichen enthalten
      expect(result).toMatch(/[-\u2212]/);
    });
  });

  describe("Kleine Betraege", () => {
    it("sollte 0,01 EUR korrekt formatieren", () => {
      const result = formatCurrency(0.01);

      expect(result).toContain("0,01");
      expect(result).toContain("€");
    });

    it("sollte 0,10 EUR korrekt formatieren", () => {
      const result = formatCurrency(0.1);

      expect(result).toContain("0,10");
      expect(result).toContain("€");
    });
  });

  describe("Grosse Betraege", () => {
    it("sollte 999.999,99 EUR mit Tausendertrennzeichen formatieren", () => {
      const result = formatCurrency(999999.99);

      expect(result).toContain("999.999,99");
      expect(result).toContain("€");
    });

    it("sollte 1.000.000 EUR korrekt formatieren", () => {
      const result = formatCurrency(1000000);

      expect(result).toContain("1.000.000,00");
      expect(result).toContain("€");
    });
  });

  describe("Ganze Betraege", () => {
    it("sollte ganzen Betrag mit zwei Dezimalstellen anzeigen", () => {
      const result = formatCurrency(42);

      expect(result).toContain("42,00");
      expect(result).toContain("€");
    });
  });

  describe("String-Eingaben", () => {
    it("sollte einen numerischen String korrekt formatieren", () => {
      const result = formatCurrency("1234.56");

      expect(result).toContain("1.234,56");
      expect(result).toContain("€");
    });

    it("sollte '0' als String korrekt formatieren", () => {
      const result = formatCurrency("0");

      expect(result).toContain("0,00");
      expect(result).toContain("€");
    });
  });
});

// ─── formatDate ─────────────────────────────────────────────────

describe("formatDate", () => {
  describe("Standard-Datumsformatierung", () => {
    it("sollte ein Date-Objekt im deutschen Format DD.MM.YYYY formatieren", () => {
      const result = formatDate(new Date(2026, 2, 21)); // Monat ist 0-basiert

      expect(result).toBe("21.03.2026");
    });

    it("sollte den 1. Januar korrekt formatieren", () => {
      const result = formatDate(new Date(2026, 0, 1));

      expect(result).toBe("01.01.2026");
    });

    it("sollte den 31. Dezember korrekt formatieren", () => {
      const result = formatDate(new Date(2026, 11, 31));

      expect(result).toBe("31.12.2026");
    });
  });

  describe("Einstellige Tage und Monate", () => {
    it("sollte einstellige Tage mit fuehrender Null formatieren", () => {
      const result = formatDate(new Date(2026, 0, 5));

      expect(result).toBe("05.01.2026");
    });

    it("sollte einstellige Monate mit fuehrender Null formatieren", () => {
      const result = formatDate(new Date(2026, 3, 15)); // April

      expect(result).toBe("15.04.2026");
    });
  });

  describe("String-Eingaben", () => {
    it("sollte einen ISO-Datumsstring korrekt formatieren", () => {
      // Verwende Mittag UTC um Zeitzonen-Probleme zu vermeiden
      const result = formatDate("2026-03-21T12:00:00.000Z");

      expect(result).toBe("21.03.2026");
    });

    it("sollte einen einfachen Datumsstring korrekt formatieren", () => {
      const result = formatDate("2026-06-15");

      // Bei reinem Datumsstring ohne Zeit kann die Zeitzone variieren
      expect(result).toContain("2026");
      expect(result).toContain("06");
      expect(result).toContain("15");
    });
  });

  describe("Randwerte", () => {
    it("sollte den 29. Februar eines Schaltjahres korrekt formatieren", () => {
      const result = formatDate(new Date(2028, 1, 29)); // 2028 ist ein Schaltjahr

      expect(result).toBe("29.02.2028");
    });

    it("sollte Jahreswechsel korrekt formatieren", () => {
      const result = formatDate(new Date(2025, 11, 31));

      expect(result).toBe("31.12.2025");
    });
  });
});
