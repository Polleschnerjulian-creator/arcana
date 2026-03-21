// ─── Bank Transaction Matching Engine ────────────────────────────
//
// Findet potenzielle Übereinstimmungen zwischen Bankbewegungen
// und offenen Posten (Rechnungen, Buchungen).

// ─── Types ───────────────────────────────────────────────────────

export interface OpenItem {
  id: string;
  type: "invoice" | "transaction";
  amount: number;
  date: Date;
  description: string;
  counterpartName?: string;
}

export interface Match {
  openItemId: string;
  openItemType: "invoice" | "transaction";
  confidence: number;
  reasons: string[];
}

interface BankTxInput {
  amount: number;
  date: Date;
  counterpartName?: string;
}

// ─── Weights ─────────────────────────────────────────────────────

const WEIGHT_AMOUNT = 0.5;
const WEIGHT_DATE = 0.3;
const WEIGHT_NAME = 0.2;

const AMOUNT_TOLERANCE = 0.01; // ±0,01 EUR
const DATE_WINDOW_DAYS = 7;    // ±7 Tage

// ─── Main Matching Function ──────────────────────────────────────

/**
 * Findet potenzielle Übereinstimmungen für eine Bankbewegung
 * unter den offenen Posten.
 *
 * Gibt Matches sortiert nach Konfidenz (absteigend) zurück.
 */
export function findPotentialMatches(
  bankTx: BankTxInput,
  openItems: OpenItem[]
): Match[] {
  const matches: Match[] = [];

  for (const item of openItems) {
    const reasons: string[] = [];
    let totalScore = 0;

    // ─── Betrag-Score (0.5) ──────────────────────────────────
    const amountScore = calculateAmountScore(
      bankTx.amount,
      item.amount,
      reasons
    );
    totalScore += amountScore * WEIGHT_AMOUNT;

    // ─── Datum-Score (0.3) ───────────────────────────────────
    const dateScore = calculateDateScore(
      bankTx.date,
      item.date,
      reasons
    );
    totalScore += dateScore * WEIGHT_DATE;

    // ─── Name-Score (0.2) ────────────────────────────────────
    const nameScore = calculateNameScore(
      bankTx.counterpartName,
      item.counterpartName,
      reasons
    );
    totalScore += nameScore * WEIGHT_NAME;

    // Nur Matches mit Mindest-Konfidenz aufnehmen
    if (totalScore > 0.1) {
      matches.push({
        openItemId: item.id,
        openItemType: item.type,
        confidence: Math.round(totalScore * 100) / 100, // auf 2 Dezimalstellen
        reasons,
      });
    }
  }

  // Nach Konfidenz absteigend sortieren
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

// ─── Score Calculations ──────────────────────────────────────────

function calculateAmountScore(
  bankAmount: number,
  itemAmount: number,
  reasons: string[]
): number {
  const diff = Math.abs(Math.abs(bankAmount) - Math.abs(itemAmount));

  if (diff <= AMOUNT_TOLERANCE) {
    reasons.push(
      `Betrag stimmt exakt überein (${formatAmount(bankAmount)})`
    );
    return 1.0;
  }

  // Prozentuale Abweichung
  const maxAmount = Math.max(Math.abs(bankAmount), Math.abs(itemAmount));
  if (maxAmount === 0) return 0;

  const percentDiff = diff / maxAmount;

  if (percentDiff <= 0.01) {
    // ±1% Abweichung
    reasons.push(
      `Betrag fast identisch (Diff: ${formatAmount(diff)})`
    );
    return 0.8;
  }

  if (percentDiff <= 0.05) {
    // ±5% Abweichung (z.B. Skonto)
    reasons.push(
      `Betrag ähnlich, mögliches Skonto (Diff: ${formatAmount(diff)})`
    );
    return 0.4;
  }

  return 0;
}

function calculateDateScore(
  bankDate: Date,
  itemDate: Date,
  reasons: string[]
): number {
  const diffMs = Math.abs(bankDate.getTime() - itemDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) {
    reasons.push("Datum stimmt überein");
    return 1.0;
  }

  if (diffDays <= DATE_WINDOW_DAYS) {
    reasons.push(
      `Datum liegt ${Math.round(diffDays)} Tage auseinander`
    );
    // Linearer Abfall: 1.0 bei 0 Tagen → 0.0 bei 7 Tagen
    return Math.max(0, 1.0 - diffDays / DATE_WINDOW_DAYS);
  }

  if (diffDays <= 30) {
    reasons.push(
      `Datum liegt ${Math.round(diffDays)} Tage auseinander (außerhalb Fenster)`
    );
    return 0.1;
  }

  return 0;
}

function calculateNameScore(
  bankName: string | undefined,
  itemName: string | undefined,
  reasons: string[]
): number {
  if (!bankName || !itemName) return 0;

  const similarity = nameSimilarity(bankName, itemName);

  if (similarity >= 0.8) {
    reasons.push(`Name stimmt überein: "${bankName}" ≈ "${itemName}"`);
    return 1.0;
  }

  if (similarity >= 0.5) {
    reasons.push(`Name ähnlich: "${bankName}" ~ "${itemName}"`);
    return 0.6;
  }

  if (similarity >= 0.3) {
    reasons.push(`Name teilweise übereinstimmend: "${bankName}" / "${itemName}"`);
    return 0.3;
  }

  return 0;
}

// ─── Name Similarity ─────────────────────────────────────────────

/**
 * Einfaches Fuzzy-Matching für Firmennamen.
 *
 * Normalisiert beide Strings (Kleinschreibung, häufige Wörter entfernen)
 * und prüft auf Inklusion und Token-Übereinstimmung.
 *
 * @returns Wert zwischen 0 (keine Ähnlichkeit) und 1 (identisch)
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  // Normalisieren
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 1.0;

  // Einer im anderen enthalten?
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    return shorter.length / longer.length;
  }

  // Token-basiertes Matching
  const tokensA = normA.split(/\s+/).filter((t) => t.length > 1);
  const tokensB = normB.split(/\s+/).filter((t) => t.length > 1);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Zählen, wie viele Tokens von A in B vorkommen (und umgekehrt)
  let matchCount = 0;
  for (const tokenA of tokensA) {
    for (const tokenB of tokensB) {
      if (tokenA === tokenB) {
        matchCount++;
        break;
      }
      // Teilstring-Match (mindestens 3 Zeichen)
      if (
        tokenA.length >= 3 &&
        tokenB.length >= 3 &&
        (tokenA.includes(tokenB) || tokenB.includes(tokenA))
      ) {
        matchCount += 0.5;
        break;
      }
    }
  }

  const maxTokens = Math.max(tokensA.length, tokensB.length);
  return matchCount / maxTokens;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Häufige Rechtsform-Suffixe und Füllwörter entfernen */
const NOISE_WORDS = [
  "gmbh",
  "ag",
  "kg",
  "ohg",
  "gbr",
  "ug",
  "e.v.",
  "ev",
  "mbh",
  "co",
  "und",
  "and",
  "&",
  "the",
  "der",
  "die",
  "das",
  "für",
  "fuer",
  "von",
  "international",
  "int",
  "ltd",
  "inc",
  "corp",
  "se",
  "sa",
  "haftungsbeschraenkt",
];

function normalizeName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[^\w\s\u00e4\u00f6\u00fc\u00df]/g, " ") // Sonderzeichen entfernen, Umlaute behalten
    .replace(/\s+/g, " ")
    .trim();

  // Noise-Wörter entfernen
  const tokens = normalized.split(" ");
  const filtered = tokens.filter((t) => !NOISE_WORDS.includes(t));

  // Nur filtern, wenn danach noch Tokens übrig bleiben
  if (filtered.length > 0) {
    normalized = filtered.join(" ");
  }

  return normalized.trim();
}

function formatAmount(amount: number): string {
  return (
    Math.abs(amount).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " EUR"
  );
}
