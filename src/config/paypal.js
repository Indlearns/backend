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

/** Currency sent to PayPal Orders API (USD works on all accounts; INR often does not). */
export const getPayPalCheckoutCurrency = () =>
  process.env.PAYPAL_CURRENCY?.trim().toUpperCase() || "USD";

/** How many INR equal 1 USD when converting listed INR prices for PayPal. */
export const getInrPerUsd = () => {
  const rate = Number(process.env.PAYPAL_INR_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : 83;
};
