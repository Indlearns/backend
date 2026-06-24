import ReferralCode from "../../models/ReferralCode.js";
import Course from "../../models/Course.js";
import Workshop from "../../models/Workshop.js";
import CoursePurchase from "../../models/CoursePurchase.js";
import WorkshopPurchase from "../../models/WorkshopPurchase.js";
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

const mapCourseUsage = (purchase) => ({
  _id: purchase._id,
  usedAt: purchase.updatedAt,
  itemType: "course",
  itemTitle: purchase.course?.title || "—",
  student: purchase.student,
  originalAmount: purchase.originalAmount || purchase.amount,
  discountAmount: purchase.discountAmount || 0,
  amountPaid: purchase.amount,
  referralCode: purchase.referralCode,
  paymentGateway: purchase.paymentGateway,
});

const mapWorkshopUsage = (purchase) => ({
  _id: purchase._id,
  usedAt: purchase.updatedAt,
  itemType: purchase.workshop?.eventType === "hackathon" ? "hackathon" : "workshop",
  itemTitle: purchase.workshop?.title || "—",
  student: purchase.student,
  originalAmount: purchase.originalAmount || purchase.amount,
  discountAmount: purchase.discountAmount || 0,
  amountPaid: purchase.amount,
  referralCode: purchase.referralCode,
  paymentGateway: purchase.paymentGateway,
});

const fetchReferralUsages = async (referralFilter) => {
  const [coursePurchases, workshopPurchases] = await Promise.all([
    CoursePurchase.find({ ...referralFilter, status: "paid" })
      .populate("student", "name email phone")
      .populate("course", "title")
      .sort({ updatedAt: -1 }),
    WorkshopPurchase.find({ ...referralFilter, status: "paid" })
      .populate("student", "name email phone")
      .populate("workshop", "title eventType")
      .sort({ updatedAt: -1 }),
  ]);

  return [...coursePurchases.map(mapCourseUsage), ...workshopPurchases.map(mapWorkshopUsage)].sort(
    (a, b) => new Date(b.usedAt) - new Date(a.usedAt)
  );
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

export const getReferralCodeUsages = async (req, res) => {
  try {
    const referral = await ReferralCode.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: "Referral code not found." });
    }

    const usages = await fetchReferralUsages({
      $or: [{ referralCodeRef: referral._id }, { referralCode: referral.code }],
    });

    res.json({
      success: true,
      data: {
        referral: { _id: referral._id, code: referral.code, discountAmount: referral.discountAmount },
        count: usages.length,
        usages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllReferralUsages = async (req, res) => {
  try {
    const usages = await fetchReferralUsages({
      $or: [{ referralCodeRef: { $ne: null } }, { referralCode: { $ne: "" } }],
    });

    res.json({ success: true, count: usages.length, data: usages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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
