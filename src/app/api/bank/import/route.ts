import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { parseCSV, getTemplateById } from "@/lib/bank/csv-parser";
import { parseMT940 } from "@/lib/bank/mt940-parser";
import type { ParsedBankTransaction } from "@/lib/bank/csv-parser";

// ─── POST: Import Bank Transactions ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Multipart-Formular parsen
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bankAccountId = formData.get("bankAccountId") as string | null;
    const format = formData.get("format") as string | null;

    // Validierung
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    // Dateigröße prüfen (max. 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Datei zu groß. Maximale Größe: 5 MB." },
        { status: 413 }
      );
    }

    if (!bankAccountId) {
      return NextResponse.json(
        { success: false, error: "Bankkonto-ID ist erforderlich." },
        { status: 400 }
      );
    }

    if (!format) {
      return NextResponse.json(
        { success: false, error: "Format ist erforderlich (sparkasse, dkb, ing, commerzbank, generic, mt940)." },
        { status: 400 }
      );
    }

    const validFormats = ["sparkasse", "dkb", "ing", "commerzbank", "generic", "mt940"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Ungültiges Format: "${format}". Erlaubt: ${validFormats.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Bankkonto prüfen — muss zur Organisation gehören
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!bankAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "Bankkonto nicht gefunden oder gehört nicht zu Ihrer Organisation.",
        },
        { status: 404 }
      );
    }

    // Datei-Inhalt lesen
    const fileContent = await file.text();

    if (!fileContent.trim()) {
      return NextResponse.json(
        { success: false, error: "Die hochgeladene Datei ist leer." },
        { status: 400 }
      );
    }

    // Parsen je nach Format
    let transactions: ParsedBankTransaction[];

    if (format === "mt940") {
      transactions = parseMT940(fileContent);
    } else {
      const template = getTemplateById(format);
      if (!template) {
        return NextResponse.json(
          { success: false, error: `Template "${format}" nicht gefunden.` },
          { status: 400 }
        );
      }
      transactions = parseCSV(fileContent, template);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Keine Transaktionen in der Datei gefunden. Bitte prüfen Sie das Format.",
        },
        { status: 400 }
      );
    }

    // Eindeutige Batch-ID generieren
    const importBatch = `IMPORT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Transaktionen in der Datenbank erstellen
    const created = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const parsed of transactions) {
        const record = await tx.bankTransaction.create({
          data: {
            bankAccountId,
            date: parsed.date,
            amount: parsed.amount,
            description: parsed.description,
            counterpartName: parsed.counterpartName || null,
            counterpartIban: parsed.counterpartIban || null,
            importBatch,
            matchStatus: "UNMATCHED",
          },
        });
        records.push(record);
      }

      // lastImportAt aktualisieren
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { lastImportAt: new Date() },
      });

      return records;
    });

    // Audit-Eintrag
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "BANK_TRANSACTION",
        entityId: importBatch,
        newState: {
          bankAccountId,
          format,
          fileName: file.name,
          transactionCount: created.length,
          batch: importBatch,
        },
      });
    } catch {
      // Audit-Modul darf den Import nicht blockieren
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          imported: created.length,
          batch: importBatch,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing bank transactions:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler beim Import." },
      { status: 500 }
    );
  }
}
