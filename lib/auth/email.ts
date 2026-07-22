import "server-only";
import { Resend } from "resend";

/**
 * Sends the one-time login code via Resend. When Resend isn't configured (local
 * dev), the code is logged to the server console instead so sign-in still works.
 */

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendLoginCode(
  email: string,
  code: string
): Promise<void> {
  if (!resendConfigured()) {
    console.log(`[Student Time Planner] Login code for ${email}: ${code}`);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const rawFrom =
    process.env.EMAIL_FROM ?? "Student Time Planner <onboarding@resend.dev>";
  const from = rawFrom.includes("<") ? rawFrom : `Student Time Planner <${rawFrom}>`;
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your Student Time Planner sign-in code",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color:#18181b;">Sign in to Student Time Planner</h2>
        <p style="color:#52525b;">Enter this code to sign in. It expires in 10 minutes.</p>
        <p style="font-size:32px; font-weight:700; letter-spacing:6px; color:#66AA3C;">${code}</p>
        <p style="color:#a1a1aa; font-size:12px;">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
  if (error) {
    throw new Error(error.message);
  }
}
