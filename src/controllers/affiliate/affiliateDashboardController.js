import Course from "../../models/Course.js";
import Workshop from "../../models/Workshop.js";
import Affiliate from "../../models/Affiliate.js";
import AffiliateSale from "../../models/AffiliateSale.js";
import AffiliateWithdrawal from "../../models/AffiliateWithdrawal.js";
import { getClientUrl } from "../../config/clientUrl.js";
import { buildPublicWorkshopFilter, isHackathonEventType } from "../../utils/workshopVisibility.js";
import { isFreePrice } from "../../utils/pricing.js";
import { AFFILIATE_MIN_WITHDRAWAL, COMMISSION_TIERS } from "../../utils/affiliateCommission.js";
import {
  sendAffiliateWithdrawalUserEmail,
  sendAffiliateWithdrawalAdminEmail,
} from "../../utils/affiliateEmail.js";

const buildAffiliateLink = (path, code) => {
  const base = getClientUrl().replace(/\/$/, "");
  const separator = path.includes("?") ? "&" : "?";
  return `${base}${path}${separator}aff=${encodeURIComponent(code)}`;
};

export const getAffiliateDashboard = async (req, res) => {
  const affiliate = await Affiliate.findById(req.user._id).select("-password");
  const [recentSales, pendingWithdrawal] = await Promise.all([
    AffiliateSale.find({ affiliate: affiliate._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    AffiliateWithdrawal.findOne({ affiliate: affiliate._id, status: "pending" }).lean(),
  ]);

  res.json({
    success: true,
    data: {
      affiliate: {
        ...affiliate.toObject(),
        profileComplete: affiliate.isProfileComplete(),
      },
      recentSales,
      pendingWithdrawal,
      commissionTiers: COMMISSION_TIERS,
      minWithdrawal: AFFILIATE_MIN_WITHDRAWAL,
    },
  });
};

export const getAffiliateProducts = async (req, res) => {
  const affiliate = await Affiliate.findById(req.user._id);
  if (!affiliate.isProfileComplete()) {
    return res.status(403).json({
      success: false,
      message: "Complete your profile (KYC and bank details) to access affiliate links.",
    });
  }

  const [courses, workshops, hackathons] = await Promise.all([
    Course.find({ status: "published" }).select("title price").sort({ title: 1 }),
    Workshop.find(buildPublicWorkshopFilter("workshop")).select("title price eventType").sort({ date: 1 }),
    Workshop.find(buildPublicWorkshopFilter("hackathon")).select("title price eventType").sort({ date: 1 }),
  ]);

  const code = affiliate.affiliateCode;
  const paidOnly = (items, type, pathPrefix) =>
    items
      .filter((item) => !isFreePrice(item))
      .map((item) => ({
        _id: item._id,
        title: item.title,
        price: item.price,
        type,
        link: buildAffiliateLink(`${pathPrefix}/${item._id}`, code),
      }));

  res.json({
    success: true,
    data: {
      affiliateCode: code,
      generalLinks: {
        courses: buildAffiliateLink("/courses", code),
        workshops: buildAffiliateLink("/workshops", code),
        hackathons: buildAffiliateLink("/events", code),
      },
      products: [
        ...paidOnly(courses, "course", "/courses"),
        ...paidOnly(
          workshops.filter((w) => !isHackathonEventType(w.eventType)),
          "workshop",
          "/workshops"
        ),
        ...paidOnly(
          hackathons.filter((w) => isHackathonEventType(w.eventType)),
          "hackathon",
          "/events"
        ),
      ],
    },
  });
};

export const getAffiliateSales = async (req, res) => {
  const sales = await AffiliateSale.find({ affiliate: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, count: sales.length, data: sales });
};

export const getAffiliateWithdrawals = async (req, res) => {
  const withdrawals = await AffiliateWithdrawal.find({ affiliate: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, count: withdrawals.length, data: withdrawals });
};

const hasWithdrawalThisMonth = async (affiliateId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = await AffiliateWithdrawal.countDocuments({
    affiliate: affiliateId,
    createdAt: { $gte: startOfMonth },
  });
  return count > 0;
};

export const requestAffiliateWithdrawal = async (req, res) => {
  try {
    const affiliate = await Affiliate.findById(req.user._id);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: "Affiliate not found." });
    }

    if (!affiliate.isProfileComplete()) {
      return res.status(400).json({
        success: false,
        message: "Complete your profile and bank details before requesting withdrawal.",
      });
    }

    if (affiliate.availableBalance < AFFILIATE_MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${AFFILIATE_MIN_WITHDRAWAL}.`,
      });
    }

    if (await AffiliateWithdrawal.exists({ affiliate: affiliate._id, status: "pending" })) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request.",
      });
    }

    if (await hasWithdrawalThisMonth(affiliate._id)) {
      return res.status(400).json({
        success: false,
        message: "You can request withdrawal only once per month.",
      });
    }

    const amount = affiliate.availableBalance;

    const withdrawal = await AffiliateWithdrawal.create({
      affiliate: affiliate._id,
      amount,
      bankAccountHolderName: affiliate.bankAccountHolderName,
      bankAccountNumber: affiliate.bankAccountNumber,
      bankIfsc: affiliate.bankIfsc,
      bankName: affiliate.bankName,
      affiliateName: affiliate.name,
      affiliateEmail: affiliate.email,
      affiliatePhone: affiliate.phone,
    });

    affiliate.availableBalance = 0;
    affiliate.lastWithdrawalRequestAt = new Date();
    await affiliate.save();

    sendAffiliateWithdrawalUserEmail(affiliate, withdrawal).catch(() => {});
    sendAffiliateWithdrawalAdminEmail(affiliate, withdrawal).catch(() => {});

    res.status(201).json({
      success: true,
      message:
        "Withdrawal request submitted. It will be processed within 3–4 working days. You will receive an email confirmation.",
      data: withdrawal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
