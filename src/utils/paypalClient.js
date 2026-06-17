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

const readPayPalBody = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const buildPayPalError = (res, body = {}) => {
  const detail = body?.details?.[0];
  const issue = detail?.issue || body?.name || "";
  const description =
    detail?.description || body?.message || `PayPal request failed (${res.status})`;

  let message = description;

  if (res.status === 401 || issue === "INVALID_CLIENT") {
    message =
      "PayPal credentials are invalid. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET match the same Live app.";
  } else if (res.status === 403 || issue === "PAYEE_ACCOUNT_RESTRICTED") {
    message =
      "PayPal live account is restricted. Complete business verification in PayPal and enable card payments (Advanced Credit and Debit Card Processing).";
  } else if (issue === "CURRENCY_NOT_SUPPORTED") {
    message = "PayPal does not support this currency for your account. Set PAYPAL_CURRENCY=USD on the server.";
  }

  const err = new Error(message);
  err.status = res.status;
  err.paypalCode = issue;
  err.paypalDetails = body;
  return err;
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
    throw buildPayPalError(res, await readPayPalBody(res));
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
      application_context: {
        brand_name: "INDLearns",
        landing_page: "NO_PREFERENCE",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
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
    throw buildPayPalError(res, await readPayPalBody(res));
  }

  return res.json();
};

export const getPayPalOrder = async (orderId) => {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw buildPayPalError(res, await readPayPalBody(res));
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

  const data = await readPayPalBody(res);
  if (!res.ok) {
    throw buildPayPalError(res, data);
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
