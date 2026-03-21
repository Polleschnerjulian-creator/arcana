import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { saveDocument } from "@/lib/documents/storage";
import { runDocumentPipeline } from "@/lib/documents/auto-pipeline";
import { prisma } from "@/lib/db";

// ─── POST: Email Import (API key auth, webhook endpoint) ─────────

interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType: string;
}

interface EmailPayload {
  from: string;
  subject: string;
  body?: string;
  attachments?: EmailAttachment[];
}

export async function POST(request: Request) {
  try {
    // Step 1: Authenticate via API key
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Ungültiger oder fehlender API-Schlüssel." },
        { status: 401 }
      );
    }

    const { organizationId, keyId } = auth;

    // Step 2: Parse and validate payload
    let payload: EmailPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Ungültiges JSON." },
        { status: 400 }
      );
    }

    if (!payload.from || !payload.subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Felder 'from' und 'subject' sind erforderlich.",
        },
        { status: 400 }
      );
    }

    const documentIds: string[] = [];

    // Step 3: Find an admin/owner user for the org (for uploadedById)
    const orgUser = await prisma.user.findFirst({
      where: {
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { id: true },
    });

    if (!orgUser) {
      return NextResponse.json(
        { success: false, error: "Kein Benutzer in der Organisation gefunden." },
        { status: 400 }
      );
    }

    // Step 4: Process attachments
    if (payload.attachments && payload.attachments.length > 0) {
      for (const attachment of payload.attachments) {
        try {
          // Validate attachment
          if (!attachment.filename || !attachment.content) {
            console.warn(
              "[Email Import] Skipping attachment without filename or content"
            );
            continue;
          }

          // Decode base64 to Buffer
          const fileBuffer = Buffer.from(attachment.content, "base64");

          // Determine MIME type
          const mimeType =
            attachment.contentType || guessMimeType(attachment.filename);

          // Save to Vercel Blob
          const { storagePath, sha256Hash } = await saveDocument(
            fileBuffer,
            attachment.filename,
            organizationId
          );

          // Create Document record
          const document = await prisma.document.create({
            data: {
              organizationId,
              fileName: attachment.filename,
              mimeType,
              fileSize: fileBuffer.length,
              storagePath,
              sha256Hash,
              uploadedById: orgUser.id,
              type: "INCOMING_INVOICE",
              ocrStatus: "PENDING",
            },
          });

          documentIds.push(document.id);

          // Fire pipeline (async, fire-and-forget)
          runDocumentPipeline(document.id, organizationId).catch((err) => {
            console.error(
              `[Email Import] Pipeline failed for document ${document.id}:`,
              err
            );
          });
        } catch (err) {
          console.error("[Email Import] Failed to process attachment:", err);
        }
      }
    }

    // Step 5: If no attachments but body contains text, create text-based document
    if (documentIds.length === 0 && payload.body && payload.body.trim()) {
      try {
        // Create a text file from the email body
        const textContent = `Von: ${payload.from}\nBetreff: ${payload.subject}\n\n${payload.body}`;
        const fileBuffer = Buffer.from(textContent, "utf-8");
        const fileName = `email-${payload.subject.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)}.txt`;

        const { storagePath, sha256Hash } = await saveDocument(
          fileBuffer,
          fileName,
          organizationId
        );

        const document = await prisma.document.create({
          data: {
            organizationId,
            fileName,
            mimeType: "text/plain",
            fileSize: fileBuffer.length,
            storagePath,
            sha256Hash,
            uploadedById: orgUser.id,
            type: "INCOMING_INVOICE",
            ocrStatus: "DONE",
            ocrText: textContent,
          },
        });

        documentIds.push(document.id);

        // Fire pipeline for AI extraction (text is already available)
        runDocumentPipeline(document.id, organizationId).catch((err) => {
          console.error(
            `[Email Import] Pipeline failed for text document ${document.id}:`,
            err
          );
        });
      } catch (err) {
        console.error("[Email Import] Failed to create text document:", err);
      }
    }

    // Step 6: Log in WebhookLog
    try {
      await prisma.webhookLog.create({
        data: {
          organizationId,
          source: "email",
          event: "email.received",
          payload: JSON.stringify({
            from: payload.from,
            subject: payload.subject,
            attachmentCount: payload.attachments?.length ?? 0,
            documentIds,
            apiKeyId: keyId,
          }),
          status: documentIds.length > 0 ? "PROCESSED" : "FAILED",
          errorMessage:
            documentIds.length === 0
              ? "Keine verarbeitbaren Anhänge oder Inhalte gefunden."
              : null,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[Email Import] Failed to create webhook log:", err);
    }

    // Step 7: Return response
    if (documentIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Keine verarbeitbaren Anhänge oder Inhalte gefunden.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        documentIds,
        message: `${documentIds.length} Dokument(e) importiert und werden verarbeitet.`,
      },
    });
  } catch (error) {
    console.error("[Email Import] Error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    tiff: "image/tiff",
    tif: "image/tiff",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
