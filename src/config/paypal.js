export const getPayPalClientId = () => process.env.PAYPAL_CLIENT_ID?.trim() || "";

export const getPayPalClientSecret = () => process.env.PAYPAL_CLIENT_SECRET?.trim() || "";

export const getPayPalMode = () => {
  const mode = process.env.PAYPAL_MODE?.trim().toLowerCase();
  if (mode === "live" || mode === "production") return "live";
  return "sandbox";
};

export const isPayPalConfigured = () =>
  Boolean(getPayPalClientId() && getPayPalClientSecret());

export const getPayPalApiBase = () =>
  getPayPalMode() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
