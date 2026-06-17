import {
  getPayPalApiBase,
  getPayPalClientId,
  getPayPalClientSecret,
  isPayPalConfigured,
} from "../config/paypal.js";

let cachedToken = null;
let tokenExpiresAt = 0;

const assertConfigured = () => {
  if (!isPayPalConfigured()) {
    const err = new Error("Payment gateway is not configured. Add PayPal credentials to backend .env");
    err.status = 503;
    throw err;
  }
};

const parsePayPalError = async (res) => {
  let body = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  const detail = body?.details?.[0]?.description || body?.message;
  return detail || `PayPal request failed (${res.status})`;
};

export const getPayPalAccessToken = async () => {
  assertConfigured();

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${getPayPalClientId()}:${getPayPalClientSecret()}`
  ).toString("base64");

  const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(await parsePayPalError(res));
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 300) - 60, 30) * 1000;
  return cachedToken;
};

export const createPayPalOrder = async ({ amount, currency, description, customId }) => {
  const token = await getPayPalAccessToken();
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency || "USD",
            value: value.toFixed(2),
          },
          description: (description || "INDLearns purchase").slice(0, 127),
          custom_id: (customId || "").slice(0, 127),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(await parsePayPalError(res));
  }

  return res.json();
};

export const getPayPalOrder = async (orderId) => {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(await parsePayPalError(res));
  }

  return res.json();
};

export const capturePayPalOrder = async (orderId) => {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(await parsePayPalError(res));
    err.paypal = data;
    throw err;
  }

  return data;
};

export const captureOrGetCompletedPayPalOrder = async (orderId) => {
  try {
    return await capturePayPalOrder(orderId);
  } catch (error) {
    const order = await getPayPalOrder(orderId);
    if (order.status === "COMPLETED") {
      return order;
    }
    throw error;
  }
};

export const getPayPalCaptureId = (order) =>
  order?.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";
