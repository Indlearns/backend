import nodemailer from "nodemailer";

export const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransport = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env");
  }

  const from =
    process.env.EMAIL_FROM || `IndLearn <${process.env.SMTP_USER}>`;

  const transport = createTransport();
  await transport.sendMail({ from, to, subject, text, html });
};

export const sendSuperAdminLoginCode = async (email, code) => {
  const subject = "Your IndLearn Super Admin login code";
  const text = [
    "IndLearn Super Admin Login",
    "",
    `Your one-time login code is: ${code}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0f766e;margin:0 0 16px">IndLearn Super Admin</h2>
      <p style="color:#334155">Use this one-time code to sign in:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f766e;margin:24px 0">${code}</p>
      <p style="color:#64748b;font-size:14px">Expires in 10 minutes. Do not share this code.</p>
    </div>
  `;

  await sendEmail({ to: email, subject, text, html });
};
