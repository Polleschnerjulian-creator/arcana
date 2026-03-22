import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "E-Mail-Versand nicht konfiguriert." };
  }

  try {
    const resend = getResend();
    if (!resend) return { success: false, error: "E-Mail-Versand nicht konfiguriert." };
    await resend.emails.send({
      from:
        params.from ||
        process.env.EMAIL_FROM ||
        "ARCANA <noreply@resend.dev>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { success: true };
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return { success: false, error: "E-Mail konnte nicht gesendet werden." };
  }
}
