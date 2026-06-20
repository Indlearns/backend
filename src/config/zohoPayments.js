export const getZohoClientId = () => process.env.ZOHO_PAYMENTS_CLIENT_ID?.trim() || "";

export const getZohoClientSecret = () => process.env.ZOHO_PAYMENTS_CLIENT_SECRET?.trim() || "";

export const getZohoRefreshToken = () => process.env.ZOHO_PAYMENTS_REFRESH_TOKEN?.trim() || "";

export const getZohoAccountId = () => process.env.ZOHO_PAYMENTS_ACCOUNT_ID?.trim() || "";

export const getZohoSigningKey = () => process.env.ZOHO_PAYMENTS_SIGNING_KEY?.trim() || "";

export const getZohoDataCenter = () => {
  const dc = process.env.ZOHO_PAYMENTS_DC?.trim().toLowerCase();
  return dc === "com" || dc === "us" ? "com" : "in";
};

export const isZohoPaymentsConfigured = () =>
  Boolean(
    getZohoClientId() &&
      getZohoClientSecret() &&
      getZohoRefreshToken() &&
      getZohoAccountId() &&
      getZohoSigningKey()
  );

export const getZohoAccountsBase = () =>
  getZohoDataCenter() === "com"
    ? "https://accounts.zoho.com"
    : "https://accounts.zoho.in";

export const getZohoPaymentsApiBase = () =>
  getZohoDataCenter() === "com"
    ? "https://payments.zoho.com/api/v1"
    : "https://payments.zoho.in/api/v1";

export const getZohoHostedCheckoutBase = () =>
  getZohoDataCenter() === "com"
    ? "https://payments.zoho.com/hostedcheckout"
    : "https://payments.zoho.in/hostedcheckout";

/** Raw client URL for redirects (preserves protocol/host casing from env). */
export const getZohoRedirectBase = () =>
  (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
