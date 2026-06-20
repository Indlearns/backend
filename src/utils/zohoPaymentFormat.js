/** Format amount for Zoho Payments API (string with 2 decimal places). */
export const formatZohoAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(2);
};

/** Normalize to 10-digit Indian mobile for Zoho (strips +91 / leading 0). */
export const normalizeIndianPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return "";
};

export const getZohoPaymentMethods = () => {
  const raw = process.env.ZOHO_PAYMENTS_METHODS?.trim();
  if (!raw) return null;
  const methods = raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  return methods.length ? methods : null;
};

export const mapZohoPaymentError = (body, fallbackStatus) => {
  const code = body?.code || "";
  const message = body?.message || body?.error || `Zoho Payments request failed (${fallbackStatus})`;

  if (code === "payments_not_enabled") {
    return "Payment collection is not enabled on your Zoho Payments merchant account yet. Complete Zoho Payments KYC/activation or contact support@zohopayments.com.";
  }
  if (code === "payment_method_type_not_supported") {
    return "Payment methods are not enabled in your Zoho Payments account. Enable UPI/card in Zoho Payments settings or set ZOHO_PAYMENTS_METHODS in backend env to match your enabled methods.";
  }
  if (message === "Invalid data provided.") {
    return "Invalid payment details sent to Zoho. Add a valid 10-digit mobile number and email in your student profile, then try again.";
  }
  return message;
};
