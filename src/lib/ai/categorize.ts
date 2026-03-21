import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIZE_TRANSACTION_PROMPT_V1 } from "./prompts";

// ─── Types ───────────────────────────────────────────────────────

export interface CategorizationResult {
  debitAccount: string;
  creditAccount: string;
  taxRate: number;
  confidence: number;
}

export interface PreviousBooking {
  debitAccount: string;
  creditAccount: string;
  taxRate: number;
  description: string;
}

export interface CategorizeParams {
  description: string;
  amount: number;
  counterpartName: string;
  chartOfAccounts: "SKR03" | "SKR04";
  previousBookings: PreviousBooking[];
}

// ─── Zod Schema ─────────────────────────────────────────────────

const categorizationSchema = z.object({
  debitAccount: z.string(),
  creditAccount: z.string(),
  taxRate: z.number(),
  confidence: z.number().min(0).max(1),
});

// ─── Main Function ──────────────────────────────────────────────

/**
 * Kategorisiert eine Transaktion automatisch und schlägt Soll-/Haben-Konten vor.
 *
 * Nutzt den Kontenrahmen (SKR03/SKR04) und vorherige Buchungen
 * desselben Geschäftspartners als Kontext.
 *
 * Benötigt einen konfigurierten ANTHROPIC_API_KEY. Ohne API-Key
 * wird null zurückgegeben und eine Warnung geloggt.
 *
 * @returns Kontovorschläge oder null bei Fehler
 */
export async function categorizeTransaction(
  params: CategorizeParams
): Promise<CategorizationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[AI Categorize] ANTHROPIC_API_KEY nicht konfiguriert — KI-Kategorisierung nicht verfügbar."
    );
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });

    // Build context message
    let userMessage = `Kategorisiere folgende Transaktion:

Beschreibung: ${params.description}
Betrag: ${params.amount} EUR
Geschäftspartner: ${params.counterpartName}
Kontenrahmen: ${params.chartOfAccounts}`;

    if (params.previousBookings.length > 0) {
      userMessage += `\n\nLetzte Buchungen für diesen Partner:`;
      for (const booking of params.previousBookings) {
        userMessage += `\n- ${booking.description}: Soll ${booking.debitAccount}, Haben ${booking.creditAccount}, ${booking.taxRate}% MwSt`;
      }
    } else {
      userMessage += `\n\nKeine vorherigen Buchungen für diesen Partner vorhanden.`;
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      system: CATEGORIZE_TRANSACTION_PROMPT_V1,
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(
        "[AI Categorize] Keine Text-Antwort von Claude erhalten."
      );
      return null;
    }

    const rawText = textBlock.text.trim();

    // Parse JSON, handle code blocks
    let jsonText = rawText;
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(
        "[AI Categorize] JSON-Parsing fehlgeschlagen:",
        parseError
      );
      return null;
    }

    const result = categorizationSchema.safeParse(parsed);
    if (!result.success) {
      console.error(
        "[AI Categorize] Zod-Validierung fehlgeschlagen:",
        result.error.issues
      );
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("[AI Categorize] Fehler bei der KI-Kategorisierung:", error);
    return null;
  }
}
