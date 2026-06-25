import nodemailer from "nodemailer";
import { getClientUrl } from "../config/clientUrl.js";

export const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const getSupportEmail = () =>
  process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "support@indlearns.com";

const getFromAddress = () =>
  process.env.EMAIL_FROM || `IndLearn <${process.env.SMTP_USER}>`;

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

export const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env");
  }

  const transport = createTransport();
  await transport.sendMail({
    from: getFromAddress(),
    to,
    replyTo: replyTo || getSupportEmail(),
    subject,
    text,
    html,
  });
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

const ENROLLMENT_COPY = {
  course: {
    subject: "Course enrollment confirmed — IndLearn",
    heading: "You're enrolled!",
    action: "enrolled in",
    portalLabel: "Go to my courses",
    portalPath: "/student/courses",
  },
  workshop: {
    subject: "Workshop registration confirmed — IndLearn",
    heading: "Registration confirmed!",
    action: "registered for",
    portalLabel: "View my workshops",
    portalPath: "/student/workshops",
  },
  hackathon: {
    subject: "Hackathon registration confirmed — IndLearn",
    heading: "Registration confirmed!",
    action: "registered for",
    portalLabel: "View my hackathons",
    portalPath: "/student/hackathons",
  },
};

export const sendEnrollmentSuccessEmail = async ({
  to,
  name,
  itemType,
  itemTitle,
  amountPaid = 0,
}) => {
  const copy = ENROLLMENT_COPY[itemType] || ENROLLMENT_COPY.course;
  const clientUrl = getClientUrl();
  const portalUrl = `${clientUrl}${copy.portalPath}`;
  const greeting = name ? `Hi ${name},` : "Hi,";
  const paidLine =
    Number(amountPaid) > 0 ? `Amount paid: ${amountPaid} INR` : "This enrollment is confirmed at no charge.";

  const subject = copy.subject;
  const text = [
    greeting,
    "",
    `Your ${copy.action} "${itemTitle}" was successful.`,
    paidLine,
    "",
    `Open your student portal: ${portalUrl}`,
    "",
    `Questions? Reply to ${getSupportEmail()}`,
    "",
    "— IndLearn Team",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="color:#0f766e;margin:0 0 8px">${copy.heading}</h2>
      <p style="color:#334155;line-height:1.6">${greeting}</p>
      <p style="color:#334155;line-height:1.6">
        You have successfully ${copy.action}
        <strong>${itemTitle}</strong>.
      </p>
      <p style="color:#64748b;font-size:14px">${paidLine}</p>
      <p style="margin:28px 0">
        <a href="${portalUrl}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          ${copy.portalLabel}
        </a>
      </p>
      <p style="color:#94a3b8;font-size:13px">
        Need help? Contact us at
        <a href="mailto:${getSupportEmail()}" style="color:#0f766e">${getSupportEmail()}</a>
      </p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
};
