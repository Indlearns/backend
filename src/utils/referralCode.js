import ReferralCode from "../models/ReferralCode.js";

export const normalizeReferralCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

export const computeCheckoutPrice = (itemPrice, discountAmount) => {
  const original = Number(itemPrice) || 0;
  const discount = Math.min(Math.max(0, Number(discountAmount) || 0), original);
  const finalAmount = Math.max(0, original - discount);
  return {
    originalAmount: original,
    discountAmount: discount,
    finalAmount,
  };
};

/** @deprecated use computeCheckoutPrice */
export const computeCourseCheckout = computeCheckoutPrice;

export const referralHasScopedTargets = (referral) =>
  (referral?.courses?.length || 0) +
    (referral?.workshops?.length || 0) +
    (referral?.hackathons?.length || 0) >
  0;

const SCOPE_FIELD_BY_TYPE = {
  course: "courses",
  workshop: "workshops",
  hackathon: "hackathons",
};

export const resolveReferralItemType = (item) => {
  if (item?.eventType === "hackathon") return "hackathon";
  if (item?.eventType === "workshop") return "workshop";
  return "course";
};

export const isReferralApplicableToItem = (referral, itemType, itemId) => {
  if (!referralHasScopedTargets(referral)) return true;

  const field = SCOPE_FIELD_BY_TYPE[itemType];
  const ids = referral[field] || [];
  if (!ids.length) return false;

  return ids.some((id) => String(id) === String(itemId));
};

export const findActiveReferralCode = async (code) => {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return ReferralCode.findOne({ code: normalized, isActive: true });
};

const ITEM_LABELS = {
  course: "course",
  workshop: "workshop",
  hackathon: "hackathon",
};

export const validateReferralForItem = async (code, item) => {
  const itemType = resolveReferralItemType(item);
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return { ok: false, message: "Enter a referral code." };
  }

  const referral = await ReferralCode.findOne({ code: normalized });
  if (!referral) {
    return { ok: false, message: "Invalid referral code." };
  }
  if (!referral.isActive) {
    return { ok: false, message: "This referral code is no longer active." };
  }
  if (referral.maxUses != null && referral.usageCount >= referral.maxUses) {
    return { ok: false, message: "This referral code has reached its usage limit." };
  }

  if (!isReferralApplicableToItem(referral, itemType, item._id)) {
    return {
      ok: false,
      message: `This referral code does not apply to this ${ITEM_LABELS[itemType]}.`,
    };
  }

  const itemPrice = Number(item?.price) || 0;
  if (itemPrice <= 0) {
    return {
      ok: false,
      message: `Referral codes apply to paid ${ITEM_LABELS[itemType]}s only.`,
    };
  }

  const pricing = computeCheckoutPrice(itemPrice, referral.discountAmount);
  if (pricing.discountAmount <= 0) {
    return {
      ok: false,
      message: `This referral code does not apply to this ${ITEM_LABELS[itemType]}.`,
    };
  }

  return {
    ok: true,
    referral,
    pricing,
    itemType,
    message: `You save ${pricing.discountAmount} INR. Pay ${pricing.finalAmount} INR.`,
  };
};

export const validateReferralForCourse = async (code, course) =>
  validateReferralForItem(code, course);

export const validateReferralForWorkshop = async (code, workshop) =>
  validateReferralForItem(code, workshop);

export const incrementReferralUsage = async (referralCodeId) => {
  if (!referralCodeId) return;
  await ReferralCode.findByIdAndUpdate(referralCodeId, { $inc: { usageCount: 1 } });
};

export const parseReferralIdList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.filter(Boolean).map(String))];
  return [];
};
