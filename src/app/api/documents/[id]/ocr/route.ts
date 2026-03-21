import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Mock OCR Text for Demo ─────────────────────────────────────

const MOCK_OCR_TEXT_INVOICE = `Muster Bürobedarf GmbH
Musterstraße 42
80331 München

Tel: 089 / 123 456 78
E-Mail: info@muster-buerobedarf.de
USt-IdNr.: DE123456789

Rechnung

Rechnungsnummer: RE-2024-00847
Rechnungsdatum: 15.11.2024
Kundennummer: K-20198

Empfänger:
ARCANA Technologies GmbH
Leopoldstraße 1
80802 München

Pos.  Beschreibung                              Menge    E-Preis      Gesamt
─────────────────────────────────────────────────────────────────────────────
1     Druckerpapier A4, 500 Blatt, 5er Pack     2        24,95 €      49,90 €
2     Tintenpatronen Multipack (CMYK)            3        34,99 €     104,97 €
3     Ordner A4 breit, grau, 10er Pack           1        45,13 €      45,13 €

                                             Zwischensumme:         200,00 €
                                             MwSt. 19%:              38,00 €
                                             ─────────────────────────────────
                                             Gesamtbetrag:          238,00 €

Zahlungsziel: 30 Tage netto
Bankverbindung: Sparkasse München
IBAN: DE89 3704 0044 0532 0130 00
BIC: COBADEFFXXX

Vielen Dank für Ihren Auftrag!`;

const MOCK_OCR_TEXT_RECEIPT = `REWE Markt GmbH
Filiale 4711
Arnulfstraße 21, 80335 München

Datum: 20.11.2024   12:34 Uhr
Bon-Nr.: 8847-2024

Kaffee Dallmayr 500g          1x    6,99 €
Milch 3,5% 1L                 2x    1,29 €
Mineralwasser 6x1,5L          1x    3,49 €

Summe Netto                        10,76 €
MwSt 7%                            0,75 €
MwSt 19%                           0,55 €
─────────────────────────────────────────
GESAMT                             12,06 €

EC-Karte                           12,06 €

USt-IdNr.: DE812706034
Vielen Dank für Ihren Einkauf!`;

// ─── POST: OCR starten (Stub) ───────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Verify document belongs to user's organization
    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Dokument nicht gefunden." },
        { status: 404 }
      );
    }

    // Check if already processed
    if (document.ocrStatus === "DONE") {
      return NextResponse.json({
        success: true,
        data: {
          id: document.id,
          ocrText: document.ocrText,
          ocrStatus: document.ocrStatus,
        },
      });
    }

    console.warn(
      `[OCR] Stub-Modus: Verwende Mock-OCR-Text für Dokument ${document.id}. Echte Tesseract-Integration folgt in Phase 2.`
    );

    // Select mock text based on document type
    const isReceipt =
      document.type === "RECEIPT" ||
      document.fileName.toLowerCase().includes("bon") ||
      document.fileName.toLowerCase().includes("kassenbon") ||
      document.fileName.toLowerCase().includes("quittung");

    const mockOcrText = isReceipt
      ? MOCK_OCR_TEXT_RECEIPT
      : MOCK_OCR_TEXT_INVOICE;

    // Update document with mock OCR text
    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        ocrText: mockOcrText,
        ocrStatus: "DONE",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        ocrText: updated.ocrText,
        ocrStatus: updated.ocrStatus,
      },
    });
  } catch (error) {
    console.error("Error processing OCR:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
