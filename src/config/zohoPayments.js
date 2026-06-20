export const ZOHO_PAYMENTS_SCOPES = "ZohoPay.payments.CREATE,ZohoPay.payments.READ";

export const getZohoClientId = () => process.env.ZOHO_PAYMENTS_CLIENT_ID?.trim() || "";

export const getZohoClientSecret = () => process.env.ZOHO_PAYMENTS_CLIENT_SECRET?.trim() || "";

export const getZohoRefreshToken = () => process.env.ZOHO_PAYMENTS_REFRESH_TOKEN?.trim() || "";

export const getZohoAccountId = () => process.env.ZOHO_PAYMENTS_ACCOUNT_ID?.trim() || "";

export const getZohoSigningKey = () => process.env.ZOHO_PAYMENTS_SIGNING_KEY?.trim() || "";

export const getZohoApiKey = () => process.env.ZOHO_PAYMENTS_API_KEY?.trim() || "";

export const getZohoDataCenter = () => {
  const dc = process.env.ZOHO_PAYMENTS_DC?.trim().toLowerCase();
  return dc === "com" || dc === "us" ? "com" : "in";
};

/** Server-based OAuth redirect URI — must match Zoho API Console exactly. */
export const getZohoOAuthRedirectUri = () => {
  const fromEnv = process.env.ZOHO_PAYMENTS_OAUTH_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return `${getZohoRedirectBase()}/zoho/oauth/callback`;
};

export const hasZohoOAuthCredentials = () =>
  Boolean(getZohoClientId() && getZohoClientSecret() && getZohoAccountId() && getZohoSigningKey());

export const isZohoPaymentsConfigured = () =>
  Boolean(hasZohoOAuthCredentials() && getZohoRefreshToken());

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

/** Raw client URL for payment return redirects. */
export const getZohoRedirectBase = () =>
  (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

export const buildZohoAuthorizationUrl = () => {
  const clientId = getZohoClientId();
  const redirectUri = getZohoOAuthRedirectUri();
  if (!clientId || !redirectUri) return "";

  const params = new URLSearchParams({
    scope: ZOHO_PAYMENTS_SCOPES,
    client_id: clientId,
    response_type: "code",
    access_type: "offline",
    redirect_uri: redirectUri,
    prompt: "consent",
  });

  return `${getZohoAccountsBase()}/oauth/v2/auth?${params.toString()}`;
};
