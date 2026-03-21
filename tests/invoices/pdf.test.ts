import { describe, it, expect } from "vitest";
import {
  generateInvoiceHTML,
  type InvoiceData,
  type OrgData,
} from "@/lib/invoices/pdf";

function makeInvoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoiceNumber: "INV-2026-001",
    customerName: "Max Mustermann",
    customerAddress: "Musterstraße 1\n12345 Musterstadt",
    issueDate: "2026-03-01",
    dueDate: "2026-03-31",
    lineItems: [
      {
        description: "Beratung",
        quantity: 10,
        unitPrice: 150.0,
        total: 1500.0,
      },
      {
        description: "Entwicklung",
        quantity: 5,
        unitPrice: 200.0,
        total: 1000.0,
      },
    ],
    subtotal: 2500.0,
    taxRate: 19,
    taxAmount: 475.0,
    total: 2975.0,
    ...overrides,
  };
}

function makeOrg(overrides: Partial<OrgData> = {}): OrgData {
  return {
    name: "Testfirma GmbH",
    street: "Hauptstraße 42",
    city: "Berlin",
    zip: "10115",
    ustId: "DE123456789",
    taxId: "27/123/45678",
    ...overrides,
  };
}

describe("generateInvoiceHTML", () => {
  it('contains "RECHNUNG"', () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    expect(html).toContain("RECHNUNG");
  });

  it("contains customer name", () => {
    const html = generateInvoiceHTML(
      makeInvoice({ customerName: "Anna Schmidt" }),
      makeOrg()
    );
    expect(html).toContain("Anna Schmidt");
  });

  it("contains invoice number", () => {
    const html = generateInvoiceHTML(
      makeInvoice({ invoiceNumber: "R-2026-042" }),
      makeOrg()
    );
    expect(html).toContain("R-2026-042");
  });

  it("contains formatted amounts in German format", () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    // German format: 2.500,00 for subtotal
    expect(html).toContain("2.500,00");
    // Total: 2.975,00
    expect(html).toContain("2.975,00");
  });

  it("contains line items", () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    expect(html).toContain("Beratung");
    expect(html).toContain("Entwicklung");
  });

  it("contains tax line when taxRate > 0", () => {
    const html = generateInvoiceHTML(
      makeInvoice({ taxRate: 19, taxAmount: 475.0 }),
      makeOrg()
    );
    expect(html).toContain("MwSt. 19");
    expect(html).toContain("475,00");
  });

  it("shows MwSt. 0% when taxRate = 0", () => {
    const html = generateInvoiceHTML(
      makeInvoice({ taxRate: 0, taxAmount: 0 }),
      makeOrg()
    );
    expect(html).toContain("MwSt. 0%");
    // Should not contain a percentage label for a non-zero rate
    expect(html).not.toContain("MwSt. 19");
  });

  it("contains org name and address", () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    expect(html).toContain("Testfirma GmbH");
    expect(html).toContain("Hauptstra");
    expect(html).toContain("10115");
    expect(html).toContain("Berlin");
  });

  it("contains payment terms with due date", () => {
    const html = generateInvoiceHTML(
      makeInvoice({ dueDate: "2026-03-31" }),
      makeOrg()
    );
    expect(html).toContain("Zahlungsbedingungen");
    expect(html).toContain("Zahlbar bis");
    // German date format: 31.03.2026
    expect(html).toContain("31.03.2026");
  });

  it("HTML starts with <!DOCTYPE", () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    expect(html.trimStart().startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("contains print button", () => {
    const html = generateInvoiceHTML(makeInvoice(), makeOrg());
    expect(html).toContain("window.print()");
    expect(html).toContain("Als PDF drucken");
  });
});
