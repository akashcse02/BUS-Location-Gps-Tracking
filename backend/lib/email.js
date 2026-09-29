import crypto from "node:crypto";

export function makeVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export async function sendVerificationEmail({ to, name, code }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "PUB Bus Track <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email service is not configured. Set RESEND_API_KEY and EMAIL_FROM in backend/.env.");
    }
    console.log(`[EMAIL DEV] Verification code for ${to}: ${code}`);
    return { delivered: false, developmentCode: code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "PUB Bus Track — Email Verification Code",
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:32px"><h2 style="margin-top:0;color:#0f172a">Verify your PUB Bus Track account</h2><p>Hello ${escapeHtml(name || "there")},</p><p>Your verification code is:</p><div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0f766e;margin:24px 0">${code}</div><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p></div></body></html>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email delivery failed: ${text.slice(0, 300)}`);
  }
  return { delivered: true };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
