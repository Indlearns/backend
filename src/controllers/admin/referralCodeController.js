import ReferralCode from "../../models/ReferralCode.js";
import { normalizeReferralCode } from "../../utils/referralCode.js";

export const createReferralCode = async (req, res) => {
  try {
    const code = normalizeReferralCode(req.body.code);
    const discountAmount = Number(req.body.discountAmount);

    if (!code) {
      return res.status(400).json({ success: false, message: "Referral code is required." });
    }
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({ success: false, message: "Discount amount must be greater than 0." });
    }

    const exists = await ReferralCode.findOne({ code });
    if (exists) {
      return res.status(400).json({ success: false, message: "This referral code already exists." });
    }

    const referral = await ReferralCode.create({
      code,
      discountAmount,
      isActive: req.body.isActive !== false,
      maxUses: req.body.maxUses ? Number(req.body.maxUses) : null,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: referral });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReferralCodes = async (req, res) => {
  const codes = await ReferralCode.find()
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
  res.json({ success: true, count: codes.length, data: codes });
};

export const updateReferralCode = async (req, res) => {
  try {
    const referral = await ReferralCode.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: "Referral code not found." });
    }

    if (req.body.code !== undefined) {
      const code = normalizeReferralCode(req.body.code);
      if (!code) {
        return res.status(400).json({ success: false, message: "Referral code cannot be empty." });
      }
      const duplicate = await ReferralCode.findOne({ code, _id: { $ne: referral._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "This referral code already exists." });
      }
      referral.code = code;
    }

    if (req.body.discountAmount !== undefined) {
      const discountAmount = Number(req.body.discountAmount);
      if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
        return res.status(400).json({ success: false, message: "Discount amount must be greater than 0." });
      }
      referral.discountAmount = discountAmount;
    }

    if (req.body.isActive !== undefined) referral.isActive = Boolean(req.body.isActive);
    if (req.body.maxUses !== undefined) {
      referral.maxUses = req.body.maxUses === "" || req.body.maxUses == null ? null : Number(req.body.maxUses);
    }

    await referral.save();
    res.json({ success: true, data: referral });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteReferralCode = async (req, res) => {
  const referral = await ReferralCode.findByIdAndDelete(req.params.id);
  if (!referral) {
    return res.status(404).json({ success: false, message: "Referral code not found." });
  }
  res.json({ success: true, message: "Referral code deleted." });
};
