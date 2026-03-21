import { describe, it, expect } from "vitest";

// Pure calculation functions — mirrors the logic used in the invoice system
function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

function calculateSubtotal(
  lines: { quantity: number; unitPrice: number }[]
): number {
  const raw = lines.reduce(
    (sum, l) => sum + calculateLineTotal(l.quantity, l.unitPrice),
    0
  );
  return Math.round(raw * 100) / 100;
}

function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate) / 100;
}

function calculateTotal(subtotal: number, taxAmount: number): number {
  return Math.round((subtotal + taxAmount) * 100) / 100;
}

describe("Invoice calculations", () => {
  describe("calculateLineTotal", () => {
    it("computes quantity * unitPrice", () => {
      expect(calculateLineTotal(10, 150)).toBe(1500);
    });

    it("handles decimal prices correctly (1.99 * 3 = 5.97)", () => {
      expect(calculateLineTotal(3, 1.99)).toBe(5.97);
    });

    it("returns 0 when quantity is 0", () => {
      expect(calculateLineTotal(0, 100)).toBe(0);
    });

    it("handles very large quantities", () => {
      const result = calculateLineTotal(1_000_000, 99.99);
      expect(result).toBe(99_990_000);
    });

    it("rounds to 2 decimal places", () => {
      // 3 * 1.33 = 3.99 exactly, but test a tricky one
      const result = calculateLineTotal(7, 0.33);
      expect(result).toBe(2.31);
    });
  });

  describe("calculateSubtotal", () => {
    it("sums all line totals", () => {
      const lines = [
        { quantity: 10, unitPrice: 150 },
        { quantity: 5, unitPrice: 200 },
      ];
      expect(calculateSubtotal(lines)).toBe(2500);
    });

    it("returns 0 for empty lines array", () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it("handles single line item", () => {
      const lines = [{ quantity: 1, unitPrice: 42.5 }];
      expect(calculateSubtotal(lines)).toBe(42.5);
    });
  });

  describe("calculateTax", () => {
    it("computes subtotal * taxRate / 100", () => {
      expect(calculateTax(2500, 19)).toBe(475);
    });

    it("returns 0 when taxRate is 0", () => {
      expect(calculateTax(2500, 0)).toBe(0);
    });

    it("rounds to 2 decimal places", () => {
      // 100 * 7 / 100 = 7.00
      expect(calculateTax(100, 7)).toBe(7);
      // 33.33 * 19 / 100 = 6.3327 → rounded = 6.33
      const result = calculateTax(33.33, 19);
      expect(result).toBe(6.33);
    });
  });

  describe("calculateTotal", () => {
    it("computes subtotal + taxAmount", () => {
      expect(calculateTotal(2500, 475)).toBe(2975);
    });

    it("equals subtotal when taxAmount is 0", () => {
      expect(calculateTotal(2500, 0)).toBe(2500);
    });

    it("rounds to 2 decimal places", () => {
      expect(calculateTotal(100.01, 19.002)).toBe(119.01);
    });
  });

  describe("end-to-end invoice calculation", () => {
    it("computes a full invoice correctly", () => {
      const lines = [
        { quantity: 10, unitPrice: 150 },
        { quantity: 5, unitPrice: 200 },
      ];
      const subtotal = calculateSubtotal(lines);
      const taxAmount = calculateTax(subtotal, 19);
      const total = calculateTotal(subtotal, taxAmount);

      expect(subtotal).toBe(2500);
      expect(taxAmount).toBe(475);
      expect(total).toBe(2975);
    });

    it("handles decimal prices end-to-end", () => {
      const lines = [
        { quantity: 3, unitPrice: 1.99 },
        { quantity: 2, unitPrice: 4.5 },
      ];
      const subtotal = calculateSubtotal(lines); // 5.97 + 9.00 = 14.97
      const taxAmount = calculateTax(subtotal, 19); // 14.97 * 19 / 100 = 2.8443 → 2.84
      const total = calculateTotal(subtotal, taxAmount); // 14.97 + 2.84 = 17.81

      expect(subtotal).toBe(14.97);
      expect(taxAmount).toBe(2.84);
      expect(total).toBe(17.81);
    });
  });
});
