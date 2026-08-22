import { sendEmail, isEmailConfigured } from "./sendEmail.js";
import { getClientUrl } from "../config/clientUrl.js";
import { getSuperAdminEmail } from "../config/roleConfig.js";

/** Affiliate withdrawal alerts go to the official IndLearn admin inbox */
const adminRecipients = () => [getSuperAdminEmail()];

export const sendAffiliateWithdrawalUserEmail = async (affiliate, withdrawal) => {
  if (!isEmailConfigured()) return;

  const subject = "Withdrawal request received — IndLearn Affiliate Program";
  const text = [
    `Hi ${affiliate.name},`,
    "",
    "Your withdrawal request has been submitted successfully.",
    "",
    `Amount requested: ₹${withdrawal.amount.toLocaleString("en-IN")}`,
    "",
    "Your withdrawal will be processed within 3–4 working days after verification.",
    "We will transfer the amount to your registered bank account.",
    "",
    "Thank you for partnering with IndLearn.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#0f766e;margin:0 0 16px">Withdrawal request received</h2>
      <p>Hi ${affiliate.name},</p>
      <p>Your withdrawal request has been submitted successfully.</p>
      <p style="font-size:18px;font-weight:bold;color:#0f766e">₹${withdrawal.amount.toLocaleString("en-IN")}</p>
      <p style="color:#475569">Your withdrawal will be processed within <strong>3–4 working days</strong> after verification. The amount will be transferred to your registered bank account.</p>
      <p style="color:#64748b;font-size:14px">Thank you for partnering with IndLearn.</p>
    </div>
  `;

  await sendEmail({ to: affiliate.email, subject, text, html });
};

export const sendAffiliateWithdrawalAdminEmail = async (affiliate, withdrawal) => {
  if (!isEmailConfigured()) return;

  const recipients = adminRecipients();
  if (!recipients.length) return;

  const adminUrl = `${getClientUrl()}/admin/affiliates`;
  const subject = `Affiliate withdrawal request — ₹${withdrawal.amount.toLocaleString("en-IN")} (${affiliate.name})`;
  const text = [
    "New affiliate withdrawal request",
    "",
    `Affiliate: ${affiliate.name}`,
    `Email: ${affiliate.email}`,
    `Phone: ${affiliate.phone || "—"}`,
    `Amount: ₹${withdrawal.amount.toLocaleString("en-IN")}`,
    "",
    "Bank details:",
    `Account holder: ${withdrawal.bankAccountHolderName}`,
    `Account number: ${withdrawal.bankAccountNumber}`,
    `IFSC: ${withdrawal.bankIfsc}`,
    `Bank: ${withdrawal.bankName}`,
    "",
    `Review in admin: ${adminUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0f766e">Affiliate withdrawal request</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b">Affiliate</td><td><strong>${affiliate.name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td>${affiliate.email}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Phone</td><td>${affiliate.phone || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Amount</td><td><strong>₹${withdrawal.amount.toLocaleString("en-IN")}</strong></td></tr>
      </table>
      <h3 style="margin-top:20px;color:#334155">Bank account</h3>
      <p style="font-size:14px;line-height:1.6">
        ${withdrawal.bankAccountHolderName}<br/>
        A/C: ${withdrawal.bankAccountNumber}<br/>
        IFSC: ${withdrawal.bankIfsc}<br/>
        ${withdrawal.bankName}
      </p>
      <p><a href="${adminUrl}" style="color:#0f766e">Open admin panel →</a></p>
    </div>
  `;

  await Promise.all(recipients.map((to) => sendEmail({ to, subject, text, html })));
};

export const sendAffiliateWithdrawalCompletedEmail = async (affiliate, withdrawal) => {
  if (!isEmailConfigured()) return;

  const subject = "Withdrawal payment completed — IndLearn Affiliate Program";
  const text = [
    `Hi ${affiliate.name},`,
    "",
    `Your withdrawal of ₹${withdrawal.amount.toLocaleString("en-IN")} has been processed and transferred to your bank account.`,
    "",
    "Thank you for partnering with IndLearn.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#0f766e">Payment completed</h2>
      <p>Hi ${affiliate.name},</p>
      <p>Your withdrawal of <strong>₹${withdrawal.amount.toLocaleString("en-IN")}</strong> has been processed and transferred to your registered bank account.</p>
      <p style="color:#64748b;font-size:14px">Thank you for partnering with IndLearn.</p>
    </div>
  `;

  await sendEmail({ to: affiliate.email, subject, text, html });
};
