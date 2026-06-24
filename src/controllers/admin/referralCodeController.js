import ReferralCode from "../../models/ReferralCode.js";
import Course from "../../models/Course.js";
import Workshop from "../../models/Workshop.js";
import {
  normalizeReferralCode,
  parseReferralIdList,
} from "../../utils/referralCode.js";

const validateReferralScope = async (courses, workshops, hackathons) => {
  if (courses.length) {
    const found = await Course.find({ _id: { $in: courses } }).select("_id");
    if (found.length !== courses.length) {
      throw new Error("One or more selected courses were not found.");
    }
  }

  if (workshops.length) {
    const found = await Workshop.find({
      _id: { $in: workshops },
      eventType: "workshop",
    }).select("_id");
    if (found.length !== workshops.length) {
      throw new Error("One or more selected workshops were not found.");
    }
  }

  if (hackathons.length) {
    const found = await Workshop.find({
      _id: { $in: hackathons },
      eventType: "hackathon",
    }).select("_id");
    if (found.length !== hackathons.length) {
      throw new Error("One or more selected hackathons were not found.");
    }
  }
};

const applyScopeFields = (referral, body) => {
  if (body.courses !== undefined) referral.courses = parseReferralIdList(body.courses);
  if (body.workshops !== undefined) referral.workshops = parseReferralIdList(body.workshops);
  if (body.hackathons !== undefined) referral.hackathons = parseReferralIdList(body.hackathons);
};

export const createReferralCode = async (req, res) => {
  try {
    const code = normalizeReferralCode(req.body.code);
    const discountAmount = Number(req.body.discountAmount);
    const courses = parseReferralIdList(req.body.courses);
    const workshops = parseReferralIdList(req.body.workshops);
    const hackathons = parseReferralIdList(req.body.hackathons);

    if (!code) {
      return res.status(400).json({ success: false, message: "Referral code is required." });
    }
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({ success: false, message: "Discount amount must be greater than 0." });
    }

    await validateReferralScope(courses, workshops, hackathons);

    const exists = await ReferralCode.findOne({ code });
    if (exists) {
      return res.status(400).json({ success: false, message: "This referral code already exists." });
    }

    const referral = await ReferralCode.create({
      code,
      discountAmount,
      courses,
      workshops,
      hackathons,
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
    .populate("courses", "title")
    .populate("workshops", "title eventType")
    .populate("hackathons", "title eventType")
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

    if (
      req.body.courses !== undefined ||
      req.body.workshops !== undefined ||
      req.body.hackathons !== undefined
    ) {
      const courses =
        req.body.courses !== undefined
          ? parseReferralIdList(req.body.courses)
          : referral.courses.map(String);
      const workshops =
        req.body.workshops !== undefined
          ? parseReferralIdList(req.body.workshops)
          : referral.workshops.map(String);
      const hackathons =
        req.body.hackathons !== undefined
          ? parseReferralIdList(req.body.hackathons)
          : referral.hackathons.map(String);

      await validateReferralScope(courses, workshops, hackathons);
      applyScopeFields(referral, { courses, workshops, hackathons });
    }

    if (req.body.isActive !== undefined) referral.isActive = Boolean(req.body.isActive);
    if (req.body.maxUses !== undefined) {
      referral.maxUses = req.body.maxUses === "" || req.body.maxUses == null ? null : Number(req.body.maxUses);
    }

    await referral.save();
    await referral.populate([
      { path: "courses", select: "title" },
      { path: "workshops", select: "title eventType" },
      { path: "hackathons", select: "title eventType" },
    ]);
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
