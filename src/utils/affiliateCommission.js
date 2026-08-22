/**
 * Affiliate commission (INR) by product list price.
 * Gaps between tiers use the lower tier rate where unspecified.
 */
export const calculateAffiliateCommission = (productPrice) => {
  const price = Number(productPrice) || 0;
  if (price <= 0) return 0;
  if (price < 300) return 10;
  if (price <= 500) return 35;
  if (price <= 1000) return 50;
  if (price <= 1500) return 50;
  if (price <= 5000) return 180;
  if (price <= 10000) return 350;
  return 1000;
};

export const AFFILIATE_MIN_WITHDRAWAL = 1000;

export const COMMISSION_TIERS = [
  { label: "Below ₹300", commission: 10 },
  { label: "₹300 – ₹500", commission: 35 },
  { label: "₹501 – ₹1,000", commission: 50 },
  { label: "₹1,001 – ₹1,500", commission: 50 },
  { label: "₹1,501 – ₹5,000", commission: 180 },
  { label: "₹5,001 – ₹10,000", commission: 350 },
  { label: "Above ₹10,000", commission: 1000 },
];
