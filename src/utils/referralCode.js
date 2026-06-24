import ReferralCode from "../models/ReferralCode.js";

export const normalizeReferralCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

export const computeCourseCheckout = (coursePrice, discountAmount) => {
  const original = Number(coursePrice) || 0;
  const discount = Math.min(Math.max(0, Number(discountAmount) || 0), original);
  const finalAmount = Math.max(0, original - discount);
  return {
    originalAmount: original,
    discountAmount: discount,
    finalAmount,
  };
};

export const findActiveReferralCode = async (code) => {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return ReferralCode.findOne({ code: normalized, isActive: true });
};

export const validateReferralForCourse = async (code, course) => {
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

  const coursePrice = Number(course?.price) || 0;
  if (coursePrice <= 0) {
    return { ok: false, message: "Referral codes apply to paid courses only." };
  }

  const pricing = computeCourseCheckout(coursePrice, referral.discountAmount);
  if (pricing.discountAmount <= 0) {
    return { ok: false, message: "This referral code does not apply to this course." };
  }

  return {
    ok: true,
    referral,
    pricing,
    message: `You save ${pricing.discountAmount} INR. Pay ${pricing.finalAmount} INR.`,
  };
};

export const incrementReferralUsage = async (referralCodeId) => {
  if (!referralCodeId) return;
  await ReferralCode.findByIdAndUpdate(referralCodeId, { $inc: { usageCount: 1 } });
};
