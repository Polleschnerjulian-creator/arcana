import { describe, it, expect } from "vitest";
import { parseMT940 } from "@/lib/bank/mt940-parser";

describe("parseMT940", () => {
  describe("basic transaction parsing", () => {
    it("parses a simple MT940 statement with one debit transaction", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Miete Maerz?32Vermieter GmbH",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-500);
      expect(result[0].description).toBe("Miete Maerz");
      expect(result[0].counterpartName).toBe("Vermieter GmbH");
      expect(result[0].date).toEqual(new Date(2026, 2, 21));
    });

    it("parses a credit transaction (C indicator)", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321C1500,00NTRFNONREF",
        ":86:005?00GUTSCHRIFT?20Zahlung Rechnung 123?32Kunde AG",
        ":62F:C260321EUR2500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1500);
      expect(result[0].description).toBe("Zahlung Rechnung 123");
      expect(result[0].counterpartName).toBe("Kunde AG");
    });

    it("parses reversal debit (RD) as positive amount", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321RD200,00NTRFNONREF",
        ":86:Storno Lastschrift",
        ":62F:C260321EUR1200,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(200);
    });

    it("parses reversal credit (RC) as negative amount", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321RC300,00NTRFNONREF",
        ":86:Storno Gutschrift",
        ":62F:C260321EUR700,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-300);
    });
  });

  describe("multiple transactions", () => {
    it("parses multiple transactions in one statement", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR10000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Miete?32Vermieter",
        ":61:260322C2000,00NTRFNONREF",
        ":86:005?00GUTSCHRIFT?20Rechnung 456?32Kunde GmbH",
        ":61:260323D100,50NTRFNONREF",
        ":86:Einkauf Supermarkt",
        ":62F:C260323EUR11399,50",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(3);
      expect(result[0].amount).toBe(-500);
      expect(result[1].amount).toBe(2000);
      expect(result[2].amount).toBe(-100.5);
    });
  });

  describe("multiple statements", () => {
    it("parses multiple statements (each starting with :20:)", () => {
      const mt940 = [
        ":20:STMT001",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D100,00NTRFNONREF",
        ":86:Zahlung 1",
        ":62F:C260321EUR900,00",
        "",
        ":20:STMT002",
        ":25:37040044/0532013000",
        ":28C:002/001",
        ":60F:C260321EUR900,00",
        ":61:260322D200,00NTRFNONREF",
        ":86:Zahlung 2",
        ":62F:C260322EUR700,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(-100);
      expect(result[1].amount).toBe(-200);
    });
  });

  describe("structured :86: block parsing", () => {
    it("extracts counterpart name from ?32/?33 fields", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Miete Maerz 2026?21inkl. Nebenkosten?32Max?33Mustermann",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].counterpartName).toBe("Max Mustermann");
      expect(result[0].description).toBe(
        "Miete Maerz 2026 inkl. Nebenkosten"
      );
    });

    it("extracts IBAN from ?31 field", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Zahlung?31DE89370400440532013000?32Firma AG",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].counterpartIban).toBe("DE89370400440532013000");
    });

    it("concatenates multiple usage fields (?20-?29)", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Rechnung Nr.?21123456?22vom 15.03.2026?32Lieferant",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe(
        "Rechnung Nr. 123456 vom 15.03.2026"
      );
    });
  });

  describe("unstructured :86: block", () => {
    it("uses entire block as description when no ? fields present", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D50,00NTRFNONREF",
        ":86:Kartenzahlung REWE Markt",
        ":62F:C260321EUR950,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe("Kartenzahlung REWE Markt");
    });
  });

  describe("date parsing", () => {
    it("correctly converts YYMMDD date format", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260101EUR1000,00",
        ":61:260115D100,00NTRFNONREF",
        ":86:Test",
        ":62F:C260115EUR900,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      // 260115 → 2026-01-15
      expect(result[0].date).toEqual(new Date(2026, 0, 15));
    });

    it("handles year boundary: 99MMDD → 1999", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C991201EUR1000,00",
        ":61:991215D100,00NTRFNONREF",
        ":86:Test",
        ":62F:C991215EUR900,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(new Date(1999, 11, 15));
    });

    it("handles year boundary: 00MMDD → 2000", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C000101EUR1000,00",
        ":61:000115D100,00NTRFNONREF",
        ":86:Test",
        ":62F:C000115EUR900,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(new Date(2000, 0, 15));
    });
  });

  describe("entry date handling", () => {
    it("parses transaction with entry date (MMDD after YYMMDD)", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:2603210321D500,00NTRFNONREF",
        ":86:Test mit Entry-Datum",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-500);
      expect(result[0].date).toEqual(new Date(2026, 2, 21));
    });
  });

  describe("BOM handling", () => {
    it("strips BOM from MT940 content", () => {
      const BOM = "\uFEFF";
      const mt940 =
        BOM +
        [
          ":20:STARTUMSE",
          ":25:37040044/0532013000",
          ":28C:001/001",
          ":60F:C260320EUR1000,00",
          ":61:260321D100,00NTRFNONREF",
          ":86:Test",
          ":62F:C260321EUR900,00",
        ].join("\n");

      const result = parseMT940(mt940);
      expect(result).toHaveLength(1);
    });
  });

  describe("CRLF handling", () => {
    it("handles Windows line endings (\\r\\n)", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D100,00NTRFNONREF",
        ":86:Test",
        ":62F:C260321EUR900,00",
      ].join("\r\n");

      const result = parseMT940(mt940);
      expect(result).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(parseMT940("")).toEqual([]);
    });

    it("returns empty array for content without :61: lines", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":62F:C260320EUR1000,00",
      ].join("\n");

      const result = parseMT940(mt940);
      expect(result).toEqual([]);
    });

    it("handles :61: line that is too short", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:abc",
        ":86:Test",
        ":62F:C260320EUR1000,00",
      ].join("\n");

      const result = parseMT940(mt940);
      expect(result).toEqual([]);
    });

    it("handles decimal amounts correctly", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D0,01NTRFNONREF",
        ":86:Kleinstbetrag",
        ":62F:C260321EUR999,99",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-0.01);
    });

    it("handles multi-line :86: blocks", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000,00",
        ":61:260321D500,00NTRFNONREF",
        ":86:005?00UEBERWEISUNG?20Rechnung",
        "Nr. 12345 vom",
        "15.03.2026",
        ":62F:C260321EUR500,00",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      // The description should contain the multi-line continuation
      expect(result[0].description).toContain("Rechnung");
    });
  });

  describe("amount parsing", () => {
    it("parses large amounts correctly", () => {
      const mt940 = [
        ":20:STARTUMSE",
        ":25:37040044/0532013000",
        ":28C:001/001",
        ":60F:C260320EUR1000000,00",
        ":61:260321C999999,99NTRFNONREF",
        ":86:Grosser Betrag",
        ":62F:C260321EUR1999999,99",
      ].join("\n");

      const result = parseMT940(mt940);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(999999.99);
    });
  });
});
