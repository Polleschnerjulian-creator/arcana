// Domain types that augment or simplify Prisma types

export type LegalForm = "EU" | "GmbH" | "UG" | "AG" | "OHG" | "KG" | "GbR" | "FreiBeruf";
export type ChartOfAccounts = "SKR03" | "SKR04";
export type AccountingMethod = "EUR" | "BILANZ";
export type UserRole = "OWNER" | "ADMIN" | "BOOKKEEPER" | "VIEWER";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type AccountCategory = "ANLAGE" | "UMLAUF" | "EIGENKAPITAL" | "ERLOES" | "AUFWAND";

export type TransactionStatus = "DRAFT" | "BOOKED" | "CANCELLED";
export type TransactionSource = "MANUAL" | "AI_SUGGESTED" | "BANK_IMPORT" | "API";

export type DocumentType = "INCOMING_INVOICE" | "OUTGOING_INVOICE" | "RECEIPT" | "BANK_STATEMENT" | "OTHER";
export type OcrStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type MatchStatus = "UNMATCHED" | "AI_SUGGESTED" | "CONFIRMED" | "MANUAL";

export type TaxPeriodType = "USTVA_MONTHLY" | "USTVA_QUARTERLY" | "ANNUAL";
export type TaxPeriodStatus = "OPEN" | "CALCULATED" | "FILED";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export type AuditAction = "CREATE" | "UPDATE" | "BOOK" | "CANCEL" | "DELETE" | "EXPORT" | "LOGIN";

export interface AiExtraction {
  vendor?: string;
  amount?: number;
  netAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  lineItems?: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  confidence: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
