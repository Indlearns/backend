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
  batches = [],
}) => {
  const copy = ENROLLMENT_COPY[itemType] || ENROLLMENT_COPY.course;
  const clientUrl = getClientUrl();
  const portalUrl = `${clientUrl}${copy.portalPath}`;
  const greeting = name ? `Hi ${name},` : "Hi,";
  const paidLine =
    Number(amountPaid) > 0
      ? `Amount paid: ${amountPaid} INR`
      : "This enrollment is confirmed at no charge.";

  const batchLines = [];
  if (batches.length) {
    batchLines.push("", "Your batch & class details:");
    for (const b of batches) {
      batchLines.push("");
      batchLines.push(`Batch: ${b.batchName}`);
      if (b.tutorName) batchLines.push(`Tutor: ${b.tutorName}`);
      if (b.sourceTitle) batchLines.push(`${b.sourceLabel || "Program"}: ${b.sourceTitle}`);
      if (b.classes?.length) {
        batchLines.push("Upcoming classes:");
        for (const c of b.classes) {
          batchLines.push(
            `  • ${c.title} — ${c.dateLabel} · ${c.startTime}–${c.endTime}${
              c.tutorName ? ` · Tutor: ${c.tutorName}` : ""
            }`
          );
        }
      } else {
        batchLines.push("  Classes will appear in your portal once scheduled.");
      }
    }
  }

  const subject = copy.subject;
  const text = [
    greeting,
    "",
    `Your ${copy.action} "${itemTitle}" was successful.`,
    paidLine,
    ...batchLines,
    "",
    `Open your student portal: ${portalUrl}`,
    "",
    `Questions? Reply to ${getSupportEmail()}`,
    "",
    "— IndLearn Team",
  ].join("\n");

  const batchHtml = batches.length
    ? batches
        .map((b) => {
          const classRows =
            b.classes?.length > 0
              ? `<ul style="padding-left:18px;margin:8px 0;color:#334155;line-height:1.6">
                  ${b.classes
                    .map(
                      (c) =>
                        `<li><strong>${c.title}</strong> — ${c.dateLabel} · ${c.startTime}–${c.endTime}${
                          c.tutorName ? ` · ${c.tutorName}` : ""
                        }</li>`
                    )
                    .join("")}
                </ul>`
              : `<p style="color:#64748b;font-size:14px;margin:8px 0">Classes will appear in your portal once scheduled.</p>`;

          return `
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc">
              <p style="margin:0 0 4px;font-weight:700;color:#0f172a">${b.batchName}</p>
              <p style="margin:0;color:#64748b;font-size:14px">
                ${b.sourceLabel || "Program"}: ${b.sourceTitle || itemTitle}
                ${b.tutorName ? ` · Tutor: ${b.tutorName}` : ""}
              </p>
              <p style="margin:12px 0 0;font-size:13px;font-weight:600;color:#0f766e">Upcoming classes</p>
              ${classRows}
            </div>`;
        })
        .join("")
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="color:#0f766e;margin:0 0 8px">${copy.heading}</h2>
      <p style="color:#334155;line-height:1.6">${greeting}</p>
      <p style="color:#334155;line-height:1.6">
        You have successfully ${copy.action}
        <strong>${itemTitle}</strong>.
      </p>
      <p style="color:#64748b;font-size:14px">${paidLine}</p>
      ${batchHtml}
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

export const sendTutorClassAssignmentEmail = async ({
  to,
  name,
  classTitle,
  batchName,
  sourceTitle,
  dateLabel,
  startTime,
  endTime,
  studentCount = 0,
  meetLink = "",
  notes = "",
}) => {
  const clientUrl = getClientUrl();
  const portalUrl = `${clientUrl}/tutor/classes`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const subject = `Class assigned: ${classTitle} — IndLearn`;
  const text = [
    greeting,
    "",
    "You have been assigned to a live class on IndLearn.",
    "",
    `Class: ${classTitle}`,
    `Batch: ${batchName}`,
    sourceTitle ? `Program: ${sourceTitle}` : null,
    `Date: ${dateLabel}`,
    `Time: ${startTime}–${endTime}`,
    `Students in batch: ${studentCount}`,
    meetLink ? `External link: ${meetLink}` : null,
    notes ? `Notes: ${notes}` : null,
    "",
    `Open tutor portal: ${portalUrl}`,
    "",
    "— IndLearn Team",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="color:#0f766e;margin:0 0 8px">New class assignment</h2>
      <p style="color:#334155;line-height:1.6">${greeting}</p>
      <p style="color:#334155;line-height:1.6">You have been assigned to a live class:</p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc">
        <p style="margin:0 0 8px;font-weight:700;font-size:18px">${classTitle}</p>
        <p style="margin:4px 0;color:#334155"><strong>Batch:</strong> ${batchName}</p>
        ${sourceTitle ? `<p style="margin:4px 0;color:#334155"><strong>Program:</strong> ${sourceTitle}</p>` : ""}
        <p style="margin:4px 0;color:#334155"><strong>Date:</strong> ${dateLabel}</p>
        <p style="margin:4px 0;color:#334155"><strong>Time:</strong> ${startTime}–${endTime}</p>
        <p style="margin:4px 0;color:#334155"><strong>Students:</strong> ${studentCount}</p>
        ${meetLink ? `<p style="margin:4px 0;color:#334155"><strong>Link:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ""}
        ${notes ? `<p style="margin:8px 0 0;color:#64748b;font-size:14px">${notes}</p>` : ""}
      </div>
      <p style="margin:28px 0">
        <a href="${portalUrl}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Open tutor classes
        </a>
      </p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
};

export const sendTutorBatchAssignmentEmail = async ({
  to,
  name,
  batchName,
  sourceLabel,
  sourceTitle,
  studentCount = 0,
  startDate,
  endDate,
}) => {
  const clientUrl = getClientUrl();
  const portalUrl = `${clientUrl}/tutor/batches`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const subject = `Batch assigned: ${batchName} — IndLearn`;
  const text = [
    greeting,
    "",
    "You have been assigned as tutor for a batch on IndLearn.",
    "",
    `Batch: ${batchName}`,
    sourceTitle ? `${sourceLabel || "Program"}: ${sourceTitle}` : null,
    `Students: ${studentCount}`,
    startDate ? `Start: ${startDate}` : null,
    endDate ? `End: ${endDate}` : null,
    "",
    `Open tutor portal: ${portalUrl}`,
    "",
    "— IndLearn Team",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="color:#0f766e;margin:0 0 8px">New batch assignment</h2>
      <p style="color:#334155;line-height:1.6">${greeting}</p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc">
        <p style="margin:0 0 8px;font-weight:700;font-size:18px">${batchName}</p>
        ${sourceTitle ? `<p style="margin:4px 0;color:#334155"><strong>${sourceLabel || "Program"}:</strong> ${sourceTitle}</p>` : ""}
        <p style="margin:4px 0;color:#334155"><strong>Students:</strong> ${studentCount}</p>
        ${startDate ? `<p style="margin:4px 0;color:#334155"><strong>Start:</strong> ${startDate}</p>` : ""}
        ${endDate ? `<p style="margin:4px 0;color:#334155"><strong>End:</strong> ${endDate}</p>` : ""}
      </div>
      <p style="margin:28px 0">
        <a href="${portalUrl}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          View my batches
        </a>
      </p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
};
