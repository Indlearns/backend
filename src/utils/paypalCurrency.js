import { getPayPalCheckoutCurrency, getInrPerUsd } from "../config/paypal.js";

/**
 * Map site listing price/currency to a PayPal-supported charge amount.
 * INR catalog prices are converted to USD by default (PayPal often rejects INR).
 */
export const resolvePayPalCharge = (amount, sourceCurrency = "INR") => {
  const source = String(sourceCurrency || "INR").toUpperCase();
  const target = getPayPalCheckoutCurrency();
  const price = Number(amount);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid payment amount.");
  }

  if (source === target) {
    return {
      amount: Math.round(price * 100) / 100,
      currency: target,
      converted: false,
      listAmount: price,
      listCurrency: source,
    };
  }

  if (source === "INR" && target === "USD") {
    const usd = Math.max(0.01, Math.round((price / getInrPerUsd()) * 100) / 100);
    return {
      amount: usd,
      currency: "USD",
      converted: true,
      listAmount: price,
      listCurrency: "INR",
      exchangeRate: getInrPerUsd(),
    };
  }

  throw new Error(
    `Cannot charge ${source} via PayPal as ${target}. Set PAYPAL_CURRENCY=USD in backend .env to convert INR prices automatically.`
  );
};
