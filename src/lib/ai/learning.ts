import { prisma } from "@/lib/db";

// ─── Vendor Name Normalization ──────────────────────────────────

/**
 * Normalizes a vendor/counterpart name for consistent matching.
 * - Lowercase
 * - Trim whitespace
 * - Remove common German legal form suffixes
 * - Collapse multiple spaces
 */
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common German legal form suffixes
    .replace(
      /\b(gmbh\s*&\s*co\.?\s*kg|gmbh|ag|e\.?\s*k\.?|ug(\s*\(haftungsbeschränkt\))?|ohg|kg|gbr|mbh|e\.?\s*v\.?|inc\.?|ltd\.?|llc|co\.?\s*kg)\b/gi,
      ""
    )
    // Remove trailing punctuation and whitespace
    .replace(/[\s.,;:&-]+$/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Learn Categorization ───────────────────────────────────────

/**
 * Save a categorization rule when user confirms or corrects a booking.
 * Called when:
 * 1. User confirms an AI-suggested booking (saves the AI's suggestion)
 * 2. User edits an AI-suggested booking (saves the user's correction)
 * 3. User manually creates a booking with a vendor/counterpart name
 *
 * Uses upsert to avoid duplicates — if a rule for this vendor already
 * exists, it updates the accounts (user correction overrides) and
 * increments the usage count.
 */
export async function learnCategorization(params: {
  organizationId: string;
  vendorName: string;
  debitAccountNumber: string;
  creditAccountNumber: string;
  taxRate?: number;
}): Promise<void> {
  const { organizationId, vendorName, debitAccountNumber, creditAccountNumber, taxRate } = params;

  if (!vendorName || !vendorName.trim()) {
    return; // Nothing to learn from empty vendor names
  }

  const normalizedVendor = normalizeVendorName(vendorName);

  if (!normalizedVendor) {
    return; // Normalization resulted in empty string
  }

  try {
    await prisma.categorizationRule.upsert({
      where: {
        organizationId_vendorPattern: {
          organizationId,
          vendorPattern: normalizedVendor,
        },
      },
      create: {
        organizationId,
        vendorPattern: normalizedVendor,
        debitAccount: debitAccountNumber,
        creditAccount: creditAccountNumber,
        taxRate: taxRate ?? null,
        confidence: 1.0,
        usageCount: 1,
        lastUsedAt: new Date(),
      },
      update: {
        debitAccount: debitAccountNumber,
        creditAccount: creditAccountNumber,
        taxRate: taxRate ?? null,
        confidence: 1.0,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  } catch (err) {
    // Learning is silent — never block the main flow
    console.error("[Learning] Failed to save categorization rule:", err);
  }
}

// ─── Find Learned Categorization ────────────────────────────────

/**
 * Look up learned categorization for a vendor.
 * Returns the best matching rule or null.
 *
 * Strategy:
 * 1. Try exact match on normalized vendor name
 * 2. If no exact match: try substring match (stored pattern is contained
 *    in the vendor name or vice versa)
 * 3. Return the rule with highest usageCount if multiple matches
 */
export async function findLearnedCategorization(
  organizationId: string,
  vendorName: string
): Promise<{
  debitAccount: string;
  creditAccount: string;
  taxRate: number | null;
  confidence: number;
} | null> {
  if (!vendorName || !vendorName.trim()) {
    return null;
  }

  const normalizedVendor = normalizeVendorName(vendorName);

  if (!normalizedVendor) {
    return null;
  }

  try {
    // Step 1: Try exact match
    const exactMatch = await prisma.categorizationRule.findUnique({
      where: {
        organizationId_vendorPattern: {
          organizationId,
          vendorPattern: normalizedVendor,
        },
      },
    });

    if (exactMatch) {
      return {
        debitAccount: exactMatch.debitAccount,
        creditAccount: exactMatch.creditAccount,
        taxRate: exactMatch.taxRate,
        confidence: exactMatch.confidence,
      };
    }

    // Step 2: Try substring match — find rules where the stored pattern
    // is contained in the vendor name or vice versa
    const allRules = await prisma.categorizationRule.findMany({
      where: { organizationId },
      orderBy: { usageCount: "desc" },
    });

    for (const rule of allRules) {
      if (
        normalizedVendor.includes(rule.vendorPattern) ||
        rule.vendorPattern.includes(normalizedVendor)
      ) {
        return {
          debitAccount: rule.debitAccount,
          creditAccount: rule.creditAccount,
          taxRate: rule.taxRate,
          confidence: rule.confidence,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("[Learning] Failed to find categorization rule:", err);
    return null;
  }
}
