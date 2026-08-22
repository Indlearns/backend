import Affiliate from "../../models/Affiliate.js";
import AffiliateSale from "../../models/AffiliateSale.js";
import AffiliateWithdrawal from "../../models/AffiliateWithdrawal.js";
import { sendAffiliateWithdrawalCompletedEmail } from "../../utils/affiliateEmail.js";

export const getAffiliatesAdmin = async (req, res) => {
  const affiliates = await Affiliate.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

  const affiliateIds = affiliates.map((a) => a._id);
  const [saleStats, pendingWithdrawals] = await Promise.all([
    AffiliateSale.aggregate([
      { $match: { affiliate: { $in: affiliateIds } } },
      {
        $group: {
          _id: "$affiliate",
          totalSales: { $sum: 1 },
          totalCommission: { $sum: "$commissionAmount" },
        },
      },
    ]),
    AffiliateWithdrawal.countDocuments({ status: "pending" }),
  ]);

  const statsMap = Object.fromEntries(
    saleStats.map((s) => [String(s._id), s])
  );

  const data = affiliates.map((affiliate) => ({
    ...affiliate,
    profileComplete: Boolean(
      affiliate.name &&
        affiliate.phone &&
        affiliate.kycType &&
        ((affiliate.kycType === "aadhar" && affiliate.aadharNumber) ||
          (affiliate.kycType === "pan" && affiliate.panNumber)) &&
        affiliate.bankAccountNumber
    ),
    salesCount: statsMap[String(affiliate._id)]?.totalSales || 0,
    commissionFromSales: statsMap[String(affiliate._id)]?.totalCommission || 0,
  }));

  res.json({
    success: true,
    count: data.length,
    pendingWithdrawals,
    data,
  });
};

export const getAffiliateByIdAdmin = async (req, res) => {
  const affiliate = await Affiliate.findById(req.params.id).select("-password").lean();
  if (!affiliate) {
    return res.status(404).json({ success: false, message: "Affiliate not found." });
  }

  const [sales, withdrawals] = await Promise.all([
    AffiliateSale.find({ affiliate: affiliate._id }).sort({ createdAt: -1 }).lean(),
    AffiliateWithdrawal.find({ affiliate: affiliate._id }).sort({ createdAt: -1 }).lean(),
  ]);

  res.json({
    success: true,
    data: {
      affiliate,
      sales,
      withdrawals,
    },
  });
};

export const getAffiliateWithdrawalsAdmin = async (req, res) => {
  const status = req.query.status || "";
  const filter = status ? { status } : {};
  const withdrawals = await AffiliateWithdrawal.find(filter)
    .populate("affiliate", "name email phone affiliateCode")
    .populate("completedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, count: withdrawals.length, data: withdrawals });
};

export const completeAffiliateWithdrawal = async (req, res) => {
  try {
    const withdrawal = await AffiliateWithdrawal.findById(req.params.id).populate("affiliate");
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found." });
    }

    if (withdrawal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "This withdrawal is already marked as completed.",
      });
    }

    withdrawal.status = "completed";
    withdrawal.completedAt = new Date();
    withdrawal.completedBy = req.user._id;
    await withdrawal.save();

    const affiliate = withdrawal.affiliate;
    if (affiliate) {
      affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) + withdrawal.amount;
      await affiliate.save();
      sendAffiliateWithdrawalCompletedEmail(affiliate, withdrawal).catch(() => {});
    }

    res.json({
      success: true,
      message: "Withdrawal marked as payment completed. Affiliate has been notified.",
      data: withdrawal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAffiliateActive = async (req, res) => {
  const affiliate = await Affiliate.findById(req.params.id);
  if (!affiliate) {
    return res.status(404).json({ success: false, message: "Affiliate not found." });
  }

  affiliate.isActive = !affiliate.isActive;
  await affiliate.save();

  res.json({
    success: true,
    message: affiliate.isActive ? "Affiliate activated." : "Affiliate deactivated.",
    data: { isActive: affiliate.isActive },
  });
};
