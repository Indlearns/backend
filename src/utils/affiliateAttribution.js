import Affiliate from "../models/Affiliate.js";

export const resolveAffiliateCode = async (codeInput) => {
  const code = String(codeInput || "")
    .trim()
    .toUpperCase();
  if (!code) return { ok: true, affiliate: null };

  const affiliate = await Affiliate.findOne({ affiliateCode: code, isActive: true });
  if (!affiliate) {
    return { ok: false, message: "Invalid affiliate link code." };
  }

  return { ok: true, affiliate, affiliateCode: affiliate.affiliateCode };
};

export const affiliateMetaFromResolution = (resolution) => {
  if (!resolution?.affiliate) {
    return { affiliateCode: "", affiliateRef: null };
  }
  return {
    affiliateCode: resolution.affiliateCode,
    affiliateRef: resolution.affiliate._id,
  };
};
