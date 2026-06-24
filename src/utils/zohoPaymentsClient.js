import crypto from "crypto";
import {
  getZohoAccountId,
  getZohoClientId,
  getZohoClientSecret,
  getZohoHostedCheckoutBase,
  getZohoOAuthRedirectUri,
  getZohoPaymentsApiBase,
  getZohoRefreshToken,
  getZohoSigningKey,
  getZohoWebhookSigningKey,
  getZohoAccountsBase,
  isZohoPaymentsConfigured,
} from "../config/zohoPayments.js";
import {
  formatZohoAmount,
  getZohoPaymentMethods,
  mapZohoPaymentError,
  normalizeIndianPhone,
} from "./zohoPaymentFormat.js";

let cachedAccessToken = null;
let tokenExpiresAt = 0;

const assertConfigured = () => {
  if (!isZohoPaymentsConfigured()) {
    const err = new Error(
      "Zoho Payments is not configured. Add Zoho OAuth and signing keys to backend .env"
    );
    err.status = 503;
    throw err;
  }
};

const parseZohoError = async (res) => {
  let body = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  return mapZohoPaymentError(body, res.status);
};

export const getZohoAccessToken = async () => {
  assertConfigured();

  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const params = new URLSearchParams({
    refresh_token: getZohoRefreshToken(),
    client_id: getZohoClientId(),
    client_secret: getZohoClientSecret(),
    grant_type: "refresh_token",
  });

  const res = await fetch(`${getZohoAccountsBase()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(await parseZohoError(res));
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error || "Could not refresh Zoho access token.");
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 120, 60) * 1000;
  return cachedAccessToken;
};

/** One-time: exchange authorization code (server-based OAuth client) for refresh token. */
export const exchangeZohoAuthorizationCode = async (code) => {
  const trimmedCode = String(code || "").trim();
  if (!trimmedCode) {
    throw new Error("Authorization code is required.");
  }

  const params = new URLSearchParams({
    code: trimmedCode,
    client_id: getZohoClientId(),
    client_secret: getZohoClientSecret(),
    redirect_uri: getZohoOAuthRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch(`${getZohoAccountsBase()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.refresh_token) {
    throw new Error(data.error || data.message || "Could not exchange authorization code.");
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
};

export const createZohoPaymentSession = async ({
  amount,
  currency,
  description,
  email,
  phone,
  name,
  successUrl,
  failureUrl,
  udf1,
  udf2,
  udf3,
}) => {
  const token = await getZohoAccessToken();
  const formattedAmount = formatZohoAmount(amount);
  if (!formattedAmount) {
    throw new Error("Invalid payment amount.");
  }

  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    const err = new Error(
      "A valid 10-digit mobile number is required. Add it in your student profile before paying."
    );
    err.status = 400;
    throw err;
  }

  const customerEmail = String(email || "").trim();
  if (!customerEmail) {
    const err = new Error("A valid email is required on your student account before paying.");
    err.status = 400;
    throw err;
  }

  const hostedParams = {
    phone_country_code: "IN",
    phone: normalizedPhone,
    name: String(name || "Student").slice(0, 100),
    email: customerEmail,
    description: (description || "INDLearns purchase").slice(0, 127),
    success_url: successUrl,
    failure_url: failureUrl,
    udf1: udf1 || "",
    udf2: udf2 || "",
    udf3: udf3 || "",
  };

  const configurations = {
    hosted_checkout_parameters: hostedParams,
  };

  const paymentMethods = getZohoPaymentMethods();
  if (paymentMethods) {
    configurations.allowed_payment_methods = paymentMethods;
  }

  const body = {
    amount: formattedAmount,
    currency: currency || "INR",
    configurations,
  };

  const url = `${getZohoPaymentsApiBase()}/paymentsessions?account_id=${encodeURIComponent(getZohoAccountId())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = new Error(await parseZohoError(res));
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const session = data.payments_session || data.payment_session;
  if (!session?.access_key || !session?.payments_session_id) {
    throw new Error("Invalid Zoho payment session response.");
  }

  return {
    sessionId: session.payments_session_id,
    accessKey: session.access_key,
    checkoutUrl: `${getZohoHostedCheckoutBase()}/${session.access_key}`,
    amount: session.amount,
    currency: session.currency,
  };
};

/** Verify hosted checkout return URL signature (HMAC-SHA256, dot-separated). */
export const verifyZohoHostedCheckoutSignature = (params) => {
  const signingKey = getZohoSigningKey();
  if (!signingKey) return false;

  const parts = [
    params.payments_session_id || "",
    params.payment_session_status || "",
    params.payment_id || "",
    params.payment_status || "",
    params.amount || "",
    params.mandate_id || "",
    params.udf1 || "",
    params.udf2 || "",
    params.udf3 || "",
    params.udf4 || "",
    params.udf5 || "",
  ];

  const message = parts.join(".");
  const expected = crypto.createHmac("sha256", signingKey).update(message).digest("hex");
  return expected === (params.signature || "");
};

/** Verify Zoho Payments webhook (X-Zoho-Webhook-Signature: t=...,v=...). */
export const verifyZohoWebhookSignature = (rawBody, signatureHeader) => {
  const signingKey = getZohoWebhookSigningKey();
  if (!signingKey || !rawBody || !signatureHeader) return false;

  const header = String(signatureHeader);
  const tMatch = header.match(/(?:^|,|\s)t=([^,\s]+)/);
  const vMatch = header.match(/(?:^|,|\s)v=([^,\s]+)/);
  const timestamp = tMatch?.[1];
  const signature = vMatch?.[1];
  if (!timestamp || !signature) return false;

  const message = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", signingKey).update(message).digest("hex");
  return expected === signature;
};

export const getZohoPaymentSession = async (sessionId) => {
  const token = await getZohoAccessToken();
  const url = `${getZohoPaymentsApiBase()}/paymentsessions/${encodeURIComponent(sessionId)}?account_id=${encodeURIComponent(getZohoAccountId())}`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (!res.ok) {
    throw new Error(await parseZohoError(res));
  }

  const data = await res.json();
  return data.payments_session || data.payment_session || data;
};
