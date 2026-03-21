import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiExtraction } from "@/types";
import { EXTRACT_INVOICE_PROMPT_V1 } from "./prompts";

// ─── Zod Schema for Validation ──────────────────────────────────

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const aiExtractionSchema = z.object({
  vendor: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  netAmount: z.number().nullable().optional(),
  taxRate: z.number().nullable().optional(),
  taxAmount: z.number().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema).nullable().optional(),
  confidence: z.number().min(0).max(1),
});

// ─── Mock Extraction for Development ────────────────────────────

function getMockExtraction(): AiExtraction {
  return {
    vendor: "Muster Bürobedarf GmbH",
    amount: 238.0,
    netAmount: 200.0,
    taxRate: 19,
    taxAmount: 38.0,
    invoiceNumber: "RE-2024-00847",
    invoiceDate: "2024-11-15",
    lineItems: [
      {
        description: "Druckerpapier A4, 500 Blatt, 5er Pack",
        quantity: 2,
        unitPrice: 24.95,
        total: 49.9,
      },
      {
        description: "Tintenpatronen Multipack (CMYK)",
        quantity: 3,
        unitPrice: 34.99,
        total: 104.97,
      },
      {
        description: "Ordner A4 breit, grau, 10er Pack",
        quantity: 1,
        unitPrice: 45.13,
        total: 45.13,
      },
    ],
    confidence: 0.91,
  };
}

// ─── Main Extraction Function ───────────────────────────────────

/**
 * Extrahiert strukturierte Rechnungsdaten aus OCR-Text mittels Claude AI.
 *
 * Bei fehlendem API-Key wird eine Mock-Extraktion zurückgegeben,
 * sodass die Anwendung auch ohne API-Key im Demo-Modus funktioniert.
 *
 * @param ocrText - Der rohe OCR-Text des Dokuments
 * @returns Die extrahierten Daten oder null bei Fehler
 */
export async function extractDocumentData(
  ocrText: string
): Promise<AiExtraction | null> {
  // Mock mode if no API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[AI Extract] ANTHROPIC_API_KEY nicht gesetzt — verwende Mock-Extraktion für Demo-Modus."
    );
    return getMockExtraction();
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Extrahiere die Rechnungsdaten aus folgendem OCR-Text:\n\n${ocrText}`,
        },
      ],
      system: EXTRACT_INVOICE_PROMPT_V1,
    });

    // Extract text content from the response
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[AI Extract] Keine Text-Antwort von Claude erhalten.");
      return null;
    }

    const rawText = textBlock.text.trim();

    // Try to parse JSON — handle potential markdown code blocks
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
        "[AI Extract] JSON-Parsing fehlgeschlagen:",
        parseError,
        "\nRoher Text:",
        rawText.slice(0, 500)
      );
      return null;
    }

    // Validate with Zod
    const result = aiExtractionSchema.safeParse(parsed);
    if (!result.success) {
      console.error(
        "[AI Extract] Zod-Validierung fehlgeschlagen:",
        result.error.issues
      );
      return null;
    }

    // Convert null optional fields to undefined for cleaner typing
    const data = result.data;
    const extraction: AiExtraction = {
      vendor: data.vendor ?? undefined,
      amount: data.amount ?? undefined,
      netAmount: data.netAmount ?? undefined,
      taxRate: data.taxRate ?? undefined,
      taxAmount: data.taxAmount ?? undefined,
      invoiceNumber: data.invoiceNumber ?? undefined,
      invoiceDate: data.invoiceDate ?? undefined,
      lineItems: data.lineItems ?? undefined,
      confidence: data.confidence,
    };

    return extraction;
  } catch (error) {
    console.error("[AI Extract] Fehler bei der KI-Extraktion:", error);
    return null;
  }
}
