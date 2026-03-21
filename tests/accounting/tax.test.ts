import { describe, it, expect } from "vitest";
import {
  calculateNetFromGross,
  calculateGrossFromNet,
  getVorsteuerAccount,
  getUmsatzsteuerAccount,
} from "@/lib/accounting/tax";

// ─── calculateNetFromGross ──────────────────────────────────────

describe("calculateNetFromGross", () => {
  describe("Standard-Steuersaetze", () => {
    it("sollte Brutto 119 EUR mit 19% korrekt in Netto 100 und Steuer 19 aufteilen", () => {
      const result = calculateNetFromGross(119, 19);

      expect(result.net).toBe(100);
      expect(result.tax).toBe(19);
    });

    it("sollte Brutto 107 EUR mit 7% korrekt in Netto 100 und Steuer 7 aufteilen", () => {
      const result = calculateNetFromGross(107, 7);

      expect(result.net).toBe(100);
      expect(result.tax).toBe(7);
    });

    it("sollte bei 0% Steuersatz Netto = Brutto und Steuer = 0 zurueckgeben", () => {
      const result = calculateNetFromGross(100, 0);

      expect(result.net).toBe(100);
      expect(result.tax).toBe(0);
    });
  });

  describe("Kleine Betraege", () => {
    it("sollte Brutto 1,19 EUR mit 19% korrekt berechnen", () => {
      const result = calculateNetFromGross(1.19, 19);

      expect(result.net).toBe(1.0);
      expect(result.tax).toBe(0.19);
    });

    it("sollte Brutto 0,01 EUR mit 19% korrekt runden", () => {
      const result = calculateNetFromGross(0.01, 19);

      // 0.01 / 1.19 = 0.008403... -> gerundet 0.01
      // Steuer = 0.01 - 0.01 = 0.00
      expect(result.net).toBe(0.01);
      expect(result.tax).toBe(0);
    });

    it("sollte Brutto 0,07 EUR mit 7% korrekt berechnen", () => {
      const result = calculateNetFromGross(0.07, 7);

      // 0.07 / 1.07 = 0.065420... -> gerundet 0.07
      // Steuer = 0.07 - 0.07 = 0.00
      expect(result.net).toBe(0.07);
      expect(result.tax).toBe(0);
    });
  });

  describe("Grosse Betraege", () => {
    it("sollte Brutto 999.999,99 EUR mit 19% korrekt berechnen", () => {
      const result = calculateNetFromGross(999999.99, 19);

      // 999999.99 / 1.19 = 840336.12605... -> gerundet 840336.13
      // Steuer = 999999.99 - 840336.13 = 159663.86
      expect(result.net).toBe(840336.13);
      expect(result.tax).toBe(159663.86);
      // Summe muss wieder den Bruttobetrag ergeben
      expect(result.net + result.tax).toBe(999999.99);
    });
  });

  describe("Rundungsfaelle", () => {
    it("sollte Brutto 10,50 EUR mit 19% korrekt runden", () => {
      const result = calculateNetFromGross(10.5, 19);

      // 10.50 / 1.19 = 8.8235294... -> gerundet 8.82
      // Steuer = 10.50 - 8.82 = 1.68
      expect(result.net).toBe(8.82);
      expect(result.tax).toBe(1.68);
      expect(result.net + result.tax).toBe(10.5);
    });

    it("sollte Brutto 1,00 EUR mit 19% korrekt runden", () => {
      const result = calculateNetFromGross(1.0, 19);

      // 1.00 / 1.19 = 0.840336... -> gerundet 0.84
      // Steuer = 1.00 - 0.84 = 0.16
      expect(result.net).toBe(0.84);
      expect(result.tax).toBe(0.16);
      expect(result.net + result.tax).toBe(1.0);
    });

    it("sollte sicherstellen dass Netto + Steuer immer exakt dem Brutto entspricht", () => {
      // Pruefe mehrere Betraege die bekannt fuer Rundungsprobleme sind
      const testCases = [
        { gross: 3.57, rate: 19 },
        { gross: 7.99, rate: 19 },
        { gross: 12.34, rate: 7 },
        { gross: 99.99, rate: 19 },
        { gross: 0.50, rate: 7 },
      ];

      for (const { gross, rate } of testCases) {
        const result = calculateNetFromGross(gross, rate);
        // Netto + Steuer muss exakt dem Brutto entsprechen
        expect(result.net + result.tax).toBeCloseTo(gross, 2);
      }
    });
  });
});

// ─── calculateGrossFromNet ──────────────────────────────────────

describe("calculateGrossFromNet", () => {
  describe("Standard-Steuersaetze", () => {
    it("sollte Netto 100 EUR mit 19% korrekt in Brutto 119 und Steuer 19 berechnen", () => {
      const result = calculateGrossFromNet(100, 19);

      expect(result.gross).toBe(119);
      expect(result.tax).toBe(19);
    });

    it("sollte Netto 100 EUR mit 7% korrekt in Brutto 107 und Steuer 7 berechnen", () => {
      const result = calculateGrossFromNet(100, 7);

      expect(result.gross).toBe(107);
      expect(result.tax).toBe(7);
    });

    it("sollte bei 0% Steuersatz Brutto = Netto und Steuer = 0 zurueckgeben", () => {
      const result = calculateGrossFromNet(100, 0);

      expect(result.gross).toBe(100);
      expect(result.tax).toBe(0);
    });
  });

  describe("Kleine Betraege", () => {
    it("sollte Netto 1,00 EUR mit 19% korrekt berechnen", () => {
      const result = calculateGrossFromNet(1.0, 19);

      expect(result.tax).toBe(0.19);
      expect(result.gross).toBe(1.19);
    });

    it("sollte Netto 0,01 EUR mit 19% korrekt runden", () => {
      const result = calculateGrossFromNet(0.01, 19);

      // 0.01 * 0.19 = 0.0019 -> gerundet 0.00
      expect(result.tax).toBe(0);
      expect(result.gross).toBe(0.01);
    });
  });

  describe("Grosse Betraege", () => {
    it("sollte Netto 840.336,13 EUR mit 19% korrekt berechnen", () => {
      const result = calculateGrossFromNet(840336.13, 19);

      expect(result.tax).toBe(159663.86);
      expect(result.gross).toBe(999999.99);
    });
  });

  describe("Rundungsfaelle", () => {
    it("sollte sicherstellen dass Netto + Steuer immer exakt dem Brutto entspricht", () => {
      const testCases = [
        { net: 8.82, rate: 19 },
        { net: 33.33, rate: 19 },
        { net: 99.99, rate: 7 },
        { net: 0.50, rate: 19 },
        { net: 1234.56, rate: 7 },
      ];

      for (const { net, rate } of testCases) {
        const result = calculateGrossFromNet(net, rate);
        expect(result.gross).toBe(
          Math.round((net + result.tax + Number.EPSILON) * 100) / 100
        );
      }
    });
  });

  describe("Konsistenz: Netto -> Brutto -> Netto", () => {
    it("sollte konsistent sein: calculateGrossFromNet dann calculateNetFromGross", () => {
      const net = 100;
      const rate = 19;

      const grossResult = calculateGrossFromNet(net, rate);
      const netResult = calculateNetFromGross(grossResult.gross, rate);

      expect(netResult.net).toBe(net);
      expect(netResult.tax).toBe(grossResult.tax);
    });

    it("sollte konsistent sein fuer 7% Steuersatz", () => {
      const net = 250;
      const rate = 7;

      const grossResult = calculateGrossFromNet(net, rate);
      const netResult = calculateNetFromGross(grossResult.gross, rate);

      expect(netResult.net).toBe(net);
      expect(netResult.tax).toBe(grossResult.tax);
    });
  });
});

// ─── getVorsteuerAccount ────────────────────────────────────────

describe("getVorsteuerAccount", () => {
  describe("SKR03 Kontenrahmen", () => {
    it("sollte Konto 1576 fuer 19% Vorsteuer in SKR03 zurueckgeben", () => {
      expect(getVorsteuerAccount(19, "SKR03")).toBe("1576");
    });

    it("sollte Konto 1571 fuer 7% Vorsteuer in SKR03 zurueckgeben", () => {
      expect(getVorsteuerAccount(7, "SKR03")).toBe("1571");
    });
  });

  describe("SKR04 Kontenrahmen", () => {
    it("sollte Konto 1406 fuer 19% Vorsteuer in SKR04 zurueckgeben", () => {
      expect(getVorsteuerAccount(19, "SKR04")).toBe("1406");
    });

    it("sollte Konto 1401 fuer 7% Vorsteuer in SKR04 zurueckgeben", () => {
      expect(getVorsteuerAccount(7, "SKR04")).toBe("1401");
    });
  });

  describe("Fehlerfaelle", () => {
    it("sollte einen Fehler werfen bei 0% Steuersatz (steuerbefreit)", () => {
      expect(() => getVorsteuerAccount(0, "SKR03")).toThrow(
        "steuerbefreite Buchungen"
      );
    });

    it("sollte einen Fehler werfen bei unterstuetztem Steuersatz 5%", () => {
      expect(() => getVorsteuerAccount(5, "SKR03")).toThrow(
        "Kein Vorsteuerkonto"
      );
    });

    it("sollte einen Fehler werfen bei unterstuetztem Steuersatz 20%", () => {
      expect(() => getVorsteuerAccount(20, "SKR04")).toThrow(
        "Kein Vorsteuerkonto"
      );
    });

    it("sollte einen Fehler werfen bei negativem Steuersatz", () => {
      expect(() => getVorsteuerAccount(-19, "SKR03")).toThrow(
        "Kein Vorsteuerkonto"
      );
    });

    it("sollte die unterstuetzten Saetze in der Fehlermeldung aufzaehlen", () => {
      try {
        getVorsteuerAccount(10, "SKR03");
      } catch (e: unknown) {
        const msg = (e as Error).message;
        expect(msg).toContain("7%");
        expect(msg).toContain("19%");
      }
    });
  });
});

// ─── getUmsatzsteuerAccount ─────────────────────────────────────

describe("getUmsatzsteuerAccount", () => {
  describe("SKR03 Kontenrahmen", () => {
    it("sollte Konto 1776 fuer 19% Umsatzsteuer in SKR03 zurueckgeben", () => {
      expect(getUmsatzsteuerAccount(19, "SKR03")).toBe("1776");
    });

    it("sollte Konto 1771 fuer 7% Umsatzsteuer in SKR03 zurueckgeben", () => {
      expect(getUmsatzsteuerAccount(7, "SKR03")).toBe("1771");
    });
  });

  describe("SKR04 Kontenrahmen", () => {
    it("sollte Konto 3806 fuer 19% Umsatzsteuer in SKR04 zurueckgeben", () => {
      expect(getUmsatzsteuerAccount(19, "SKR04")).toBe("3806");
    });

    it("sollte Konto 3801 fuer 7% Umsatzsteuer in SKR04 zurueckgeben", () => {
      expect(getUmsatzsteuerAccount(7, "SKR04")).toBe("3801");
    });
  });

  describe("Fehlerfaelle", () => {
    it("sollte einen Fehler werfen bei 0% Steuersatz (steuerbefreit)", () => {
      expect(() => getUmsatzsteuerAccount(0, "SKR03")).toThrow(
        "steuerbefreite Buchungen"
      );
    });

    it("sollte einen Fehler werfen bei unterstuetztem Steuersatz 5%", () => {
      expect(() => getUmsatzsteuerAccount(5, "SKR03")).toThrow(
        "Kein Umsatzsteuerkonto"
      );
    });

    it("sollte einen Fehler werfen bei unterstuetztem Steuersatz 20%", () => {
      expect(() => getUmsatzsteuerAccount(20, "SKR04")).toThrow(
        "Kein Umsatzsteuerkonto"
      );
    });

    it("sollte die unterstuetzten Saetze in der Fehlermeldung aufzaehlen", () => {
      try {
        getUmsatzsteuerAccount(10, "SKR04");
      } catch (e: unknown) {
        const msg = (e as Error).message;
        expect(msg).toContain("7%");
        expect(msg).toContain("19%");
      }
    });
  });
});
