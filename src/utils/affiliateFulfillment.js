import Affiliate from "../models/Affiliate.js";
import AffiliateSale from "../models/AffiliateSale.js";
import User from "../models/User.js";
import Workshop from "../models/Workshop.js";
import { calculateAffiliateCommission } from "./affiliateCommission.js";
import { isHackathonEventType } from "./workshopVisibility.js";

const purchaseTypeFromWorkshop = async (workshopId) => {
  if (!workshopId) return "workshop";
  const workshop = await Workshop.findById(workshopId).select("eventType");
  return workshop && isHackathonEventType(workshop.eventType) ? "hackathon" : "workshop";
};

/** Credit affiliate commission once per paid purchase (idempotent). */
export const recordAffiliateCommission = async ({
  purchase,
  purchaseType,
  productTitle,
  productId,
}) => {
  if (!purchase?.affiliateRef || purchase.affiliateCommissionRecorded) {
    return { recorded: false };
  }

  const productPrice = purchase.originalAmount ?? purchase.amount ?? 0;
  if (productPrice <= 0) {
    return { recorded: false, reason: "free_product" };
  }

  const commissionAmount = calculateAffiliateCommission(productPrice);
  if (commissionAmount <= 0) {
    return { recorded: false, reason: "zero_commission" };
  }

  let salePurchaseType = purchaseType;
  if (purchaseType === "workshop" && productId) {
    salePurchaseType = await purchaseTypeFromWorkshop(productId);
  }

  const existing = await AffiliateSale.findOne({
    purchaseType: salePurchaseType,
    purchaseId: purchase._id,
  });
  if (existing) {
    return { recorded: false, reason: "already_recorded" };
  }

  const student = purchase.student
    ? await User.findById(purchase.student).select("name email")
    : null;

  await AffiliateSale.create({
    affiliate: purchase.affiliateRef,
    purchaseType: salePurchaseType,
    purchaseId: purchase._id,
    productId,
    productTitle: productTitle || "Product",
    productPrice,
    amountPaid: purchase.amount ?? 0,
    commissionAmount,
    buyerName: student?.name || "",
    buyerEmail: student?.email || "",
  });

  await Affiliate.findByIdAndUpdate(purchase.affiliateRef, {
    $inc: {
      availableBalance: commissionAmount,
      totalEarned: commissionAmount,
    },
  });

  purchase.affiliateCommissionRecorded = true;
  await purchase.save();

  return { recorded: true, commissionAmount };
};

export const loadProductTitle = async (purchaseType, productId, Model) => {
  const doc = await Model.findById(productId).select("title");
  return doc?.title || "Product";
};
