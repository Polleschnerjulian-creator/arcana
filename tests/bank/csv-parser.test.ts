import { describe, it, expect } from "vitest";
import {
  parseCSV,
  parseGermanNumber,
  parseGermanDate,
  GENERIC,
  SPARKASSE,
  DKB,
  ING,
  COMMERZBANK,
  getTemplateById,
  type BankTemplate,
  type ParsedBankTransaction,
} from "@/lib/bank/csv-parser";

// ─── parseGermanNumber ──────────────────────────────────────────

describe("parseGermanNumber", () => {
  describe("German format (de)", () => {
    it('parses "1.234,56" → 1234.56', () => {
      expect(parseGermanNumber("1.234,56")).toBe(1234.56);
    });

    it('parses "-1.234,56" → -1234.56', () => {
      expect(parseGermanNumber("-1.234,56")).toBe(-1234.56);
    });

    it('parses "-500,00" → -500', () => {
      expect(parseGermanNumber("-500,00")).toBe(-500);
    });

    it('parses "0,01" → 0.01', () => {
      expect(parseGermanNumber("0,01")).toBe(0.01);
    });

    it('parses "1000" → 1000 (no decimal)', () => {
      expect(parseGermanNumber("1000")).toBe(1000);
    });

    it('parses "1.000.000,99" → 1000000.99 (millions)', () => {
      expect(parseGermanNumber("1.000.000,99")).toBe(1000000.99);
    });

    it('parses "0,00" → 0', () => {
      expect(parseGermanNumber("0,00")).toBe(0);
    });

    it('parses "+1.234,56" → 1234.56 (leading plus)', () => {
      expect(parseGermanNumber("+1.234,56")).toBe(1234.56);
    });

    it('parses "1.234,56 €" → 1234.56 (currency symbol)', () => {
      expect(parseGermanNumber("1.234,56 €")).toBe(1234.56);
    });

    it('parses "€ 100,00" → 100 (currency prefix)', () => {
      expect(parseGermanNumber("€ 100,00")).toBe(100);
    });

    it('parses "$500,00" → 500 (dollar sign)', () => {
      expect(parseGermanNumber("$500,00")).toBe(500);
    });

    it('returns NaN for empty string', () => {
      expect(parseGermanNumber("")).toBeNaN();
    });

    it('returns NaN for whitespace only', () => {
      expect(parseGermanNumber("   ")).toBeNaN();
    });

    it("handles leading/trailing whitespace", () => {
      expect(parseGermanNumber("  1.234,56  ")).toBe(1234.56);
    });
  });

  describe("English format (en)", () => {
    it('parses "1234.56" → 1234.56', () => {
      expect(parseGermanNumber("1234.56", "en")).toBe(1234.56);
    });

    it('parses "-500.00" → -500', () => {
      expect(parseGermanNumber("-500.00", "en")).toBe(-500);
    });

    it('parses "1000" → 1000', () => {
      expect(parseGermanNumber("1000", "en")).toBe(1000);
    });
  });
});

// ─── parseGermanDate ────────────────────────────────────────────

describe("parseGermanDate", () => {
  describe("DD.MM.YYYY format", () => {
    it('parses "21.03.2026" correctly', () => {
      const result = parseGermanDate("21.03.2026", "DD.MM.YYYY");
      expect(result).toEqual(new Date(2026, 2, 21));
    });

    it('parses "01.01.2026" correctly (start of year)', () => {
      const result = parseGermanDate("01.01.2026", "DD.MM.YYYY");
      expect(result).toEqual(new Date(2026, 0, 1));
    });

    it('parses "31.12.2025" correctly (end of year)', () => {
      const result = parseGermanDate("31.12.2025", "DD.MM.YYYY");
      expect(result).toEqual(new Date(2025, 11, 31));
    });

    it('parses "1.1.2026" correctly (single digit day/month)', () => {
      const result = parseGermanDate("1.1.2026", "DD.MM.YYYY");
      expect(result).toEqual(new Date(2026, 0, 1));
    });

    it("returns null for empty string", () => {
      expect(parseGermanDate("", "DD.MM.YYYY")).toBeNull();
    });

    it("returns null for invalid date format", () => {
      expect(parseGermanDate("2026-03-21", "DD.MM.YYYY")).toBeNull();
    });

    it("returns null for gibberish", () => {
      expect(parseGermanDate("abc", "DD.MM.YYYY")).toBeNull();
    });

    it("handles whitespace around the date", () => {
      const result = parseGermanDate("  21.03.2026  ", "DD.MM.YYYY");
      expect(result).toEqual(new Date(2026, 2, 21));
    });
  });

  describe("DD.MM.YY format", () => {
    it('parses "21.03.26" → 2026 (2-digit year, < 50)', () => {
      const result = parseGermanDate("21.03.26", "DD.MM.YY");
      expect(result).toEqual(new Date(2026, 2, 21));
    });

    it('parses "15.06.00" → 2000 (year 00)', () => {
      const result = parseGermanDate("15.06.00", "DD.MM.YY");
      expect(result).toEqual(new Date(2000, 5, 15));
    });

    it('parses "15.06.49" → 2049 (year 49, boundary)', () => {
      const result = parseGermanDate("15.06.49", "DD.MM.YY");
      expect(result).toEqual(new Date(2049, 5, 15));
    });

    it('parses "15.06.50" → 1950 (year 50, boundary)', () => {
      const result = parseGermanDate("15.06.50", "DD.MM.YY");
      expect(result).toEqual(new Date(1950, 5, 15));
    });

    it('parses "15.06.99" → 1999 (year 99)', () => {
      const result = parseGermanDate("15.06.99", "DD.MM.YY");
      expect(result).toEqual(new Date(1999, 5, 15));
    });

    it("returns null for 4-digit year in DD.MM.YY format", () => {
      expect(parseGermanDate("21.03.2026", "DD.MM.YY")).toBeNull();
    });
  });

  describe("YYYY-MM-DD format", () => {
    it('parses "2026-03-21" correctly', () => {
      const result = parseGermanDate("2026-03-21", "YYYY-MM-DD");
      expect(result).toEqual(new Date(2026, 2, 21));
    });

    it('parses "2025-01-01" correctly', () => {
      const result = parseGermanDate("2025-01-01", "YYYY-MM-DD");
      expect(result).toEqual(new Date(2025, 0, 1));
    });

    it("returns null for German format in ISO mode", () => {
      expect(parseGermanDate("21.03.2026", "YYYY-MM-DD")).toBeNull();
    });
  });

  describe("default format", () => {
    it("defaults to DD.MM.YYYY when no format specified", () => {
      const result = parseGermanDate("21.03.2026");
      expect(result).toEqual(new Date(2026, 2, 21));
    });
  });
});

// ─── getTemplateById ────────────────────────────────────────────

describe("getTemplateById", () => {
  it("returns Sparkasse template", () => {
    expect(getTemplateById("sparkasse")).toBe(SPARKASSE);
  });

  it("returns DKB template", () => {
    expect(getTemplateById("dkb")).toBe(DKB);
  });

  it("returns ING template", () => {
    expect(getTemplateById("ing")).toBe(ING);
  });

  it("returns Commerzbank template", () => {
    expect(getTemplateById("commerzbank")).toBe(COMMERZBANK);
  });

  it("returns Generic template", () => {
    expect(getTemplateById("generic")).toBe(GENERIC);
  });

  it("returns undefined for unknown template", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });
});

// ─── parseCSV ───────────────────────────────────────────────────

describe("parseCSV", () => {
  describe("basic parsing with GENERIC template", () => {
    it("parses simple semicolon-separated CSV into transactions", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-500,00;Miete März;Vermieter GmbH;DE89370400440532013000",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);

      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(new Date(2026, 2, 21));
      expect(result[0].amount).toBe(-500);
      expect(result[0].description).toBe("Miete März");
      expect(result[0].counterpartName).toBe("Vermieter GmbH");
      expect(result[0].counterpartIban).toBe("DE89370400440532013000");
    });

    it("parses multiple rows", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-500,00;Miete;Vermieter;DE89370400440532013000",
        "22.03.2026;1.234,56;Einnahme;Kunde;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(-500);
      expect(result[1].amount).toBe(1234.56);
    });

    it("handles German number format correctly", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "01.01.2026;1.234,56;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result[0].amount).toBe(1234.56);
    });

    it("handles negative German numbers", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "01.01.2026;-1.234,56;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result[0].amount).toBe(-1234.56);
    });
  });

  describe("BOM handling", () => {
    it("strips UTF-8 BOM at start of file", () => {
      const BOM = "\uFEFF";
      const csv =
        BOM +
        [
          "Datum;Betrag;Beschreibung;Name;IBAN",
          "21.03.2026;-100,00;Test;Firma;DE12345678901234567890",
        ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-100);
    });
  });

  describe("quoted fields", () => {
    it("parses quoted fields with semicolons inside", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        '21.03.2026;-100,00;"Miete; inkl. NK";Vermieter;DE12345678901234567890',
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe("Miete; inkl. NK");
    });

    it("handles escaped quotes inside quoted fields", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        '21.03.2026;-100,00;"Rechnung ""123""";Firma;DE12345678901234567890',
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Rechnung "123"');
    });
  });

  describe("empty rows and header handling", () => {
    it("skips empty rows", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "",
        "21.03.2026;-100,00;Test;Firma;DE12345678901234567890",
        "",
        "22.03.2026;-200,00;Test2;Firma2;DE12345678901234567891",
        "",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(2);
    });

    it("skips header row", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-100,00;Zahlung;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
      // Ensure the header is not parsed as a transaction
      expect(result[0].description).toBe("Zahlung");
    });

    it("returns empty array for header-only CSV (no data)", () => {
      const csv = "Datum;Betrag;Beschreibung;Name;IBAN";
      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty input", () => {
      const result = parseCSV("", GENERIC);
      expect(result).toEqual([]);
    });
  });

  describe("invalid/missing data handling", () => {
    it("skips rows with invalid date", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "invalid;-100,00;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("skips rows with missing date column", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        ";-100,00;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("skips rows with missing amount", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("skips rows with missing description", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-100,00;;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("skips rows with not enough columns", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-100,00",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("handles rows with NaN amount gracefully", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;abc;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toEqual([]);
    });

    it("handles optional counterpart fields being empty", () => {
      const csv = [
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-100,00;Abhebung;;",
      ].join("\n");

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
      expect(result[0].counterpartName).toBeUndefined();
      expect(result[0].counterpartIban).toBeUndefined();
    });
  });

  describe("line endings", () => {
    it("handles \\r\\n line endings (Windows)", () => {
      const csv =
        "Datum;Betrag;Beschreibung;Name;IBAN\r\n" +
        "21.03.2026;-100,00;Test;Firma;DE12345678901234567890\r\n";

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
    });

    it("handles \\n line endings (Unix)", () => {
      const csv =
        "Datum;Betrag;Beschreibung;Name;IBAN\n" +
        "21.03.2026;-100,00;Test;Firma;DE12345678901234567890\n";

      const result = parseCSV(csv, GENERIC);
      expect(result).toHaveLength(1);
    });
  });

  describe("Sparkasse template (DD.MM.YY date format)", () => {
    it("parses with 2-digit year format", () => {
      // Sparkasse uses column 0=date, 14=amount, 4=description, 11=name, 12=iban
      // Need at least 15 columns (index 14)
      const cols = new Array(15).fill("");
      cols[0] = "21.03.26";
      cols[14] = "-500,00";
      cols[4] = "Miete März";
      cols[11] = "Vermieter GmbH";
      cols[12] = "DE89370400440532013000";

      const csv = [
        "Header;" + new Array(14).fill("H").join(";"),
        cols.join(";"),
      ].join("\n");

      const result = parseCSV(csv, SPARKASSE);
      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(new Date(2026, 2, 21));
      expect(result[0].amount).toBe(-500);
      expect(result[0].description).toBe("Miete März");
      expect(result[0].counterpartName).toBe("Vermieter GmbH");
    });
  });

  describe("DKB template", () => {
    it("parses DKB CSV format", () => {
      // DKB: columns 0=date, 7=amount, 4=description, 3=name, 5=iban
      // Need at least 8 columns (index 7)
      const cols = new Array(8).fill("");
      cols[0] = "21.03.2026";
      cols[7] = "-250,00";
      cols[4] = "Lastschrift";
      cols[3] = "Strom AG";
      cols[5] = "DE89370400440532013000";

      const csv = ["H;H;H;H;H;H;H;H", cols.join(";")].join("\n");

      const result = parseCSV(csv, DKB);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-250);
      expect(result[0].description).toBe("Lastschrift");
      expect(result[0].counterpartName).toBe("Strom AG");
    });
  });

  describe("credit/debit split columns", () => {
    it.skip("creditAmount column support — feature not yet implemented", () => {});
  });

  describe("multiple header rows", () => {
    it("skips multiple header rows if configured", () => {
      const template: BankTemplate = {
        ...GENERIC,
        headerRows: 3,
      };

      const csv = [
        "Bank Export",
        "Konto: 123456",
        "Datum;Betrag;Beschreibung;Name;IBAN",
        "21.03.2026;-100,00;Test;Firma;DE12345678901234567890",
      ].join("\n");

      const result = parseCSV(csv, template);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-100);
    });
  });
});
