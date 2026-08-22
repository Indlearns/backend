import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";
import User from "../models/User.js";
import {
  findCoursePurchaseForVerify,
  findWorkshopPurchaseForVerify,
} from "./paymentPurchase.js";
import { incrementReferralUsage } from "./referralCode.js";
import { notifyEnrollmentSuccess } from "./enrollmentEmail.js";
import {
  loadProductTitle,
  recordAffiliateCommission,
} from "./affiliateFulfillment.js";

const grantCourseAccess = async (studentId, courseId) => {
  await User.findByIdAndUpdate(studentId, {
    $addToSet: { enrolledCourses: courseId },
  });
};

const grantWorkshopAccess = async (studentId, workshopId) => {
  await User.findByIdAndUpdate(studentId, {
    $addToSet: { registeredWorkshops: workshopId },
  });
};

const creditAffiliateForCourse = async (purchase) => {
  const title = await loadProductTitle("course", purchase.course, Course);
  await recordAffiliateCommission({
    purchase,
    purchaseType: "course",
    productTitle: title,
    productId: purchase.course,
  });
};

const creditAffiliateForWorkshop = async (purchase) => {
  const title = await loadProductTitle("workshop", purchase.workshop, Workshop);
  await recordAffiliateCommission({
    purchase,
    purchaseType: "workshop",
    productTitle: title,
    productId: purchase.workshop,
  });
};

const finalizePaidPurchase = async (purchase, sessionId, paymentId) => {
  if (purchase.status !== "paid") {
    purchase.status = "paid";
    purchase.paymentGateway = "zoho";
    purchase.paymentOrderId = sessionId;
    purchase.paymentTransactionId = paymentId || "";
    await purchase.save();
    if (purchase.referralCodeRef) {
      await incrementReferralUsage(purchase.referralCodeRef);
    }
  }
};

/** Grant course/workshop access after Zoho payment (return URL or webhook). */
export const fulfillZohoPayment = async ({
  sessionId,
  paymentId,
  purchaseType,
  itemId,
  studentId,
}) => {
  if (!sessionId || !studentId || !itemId) {
    return { ok: false, reason: "missing_fields" };
  }

  if (purchaseType === "course") {
    const purchase = await findCoursePurchaseForVerify(studentId, sessionId, itemId);
    if (!purchase) return { ok: false, reason: "purchase_not_found" };
    if (purchase.status === "paid") {
      await creditAffiliateForCourse(purchase);
      return { ok: true, alreadyPaid: true, purchaseType: "course", itemId: purchase.course };
    }

    await finalizePaidPurchase(purchase, sessionId, paymentId);
    await grantCourseAccess(studentId, purchase.course);
    await creditAffiliateForCourse(purchase);
    notifyEnrollmentSuccess({
      studentId,
      purchaseType: "course",
      itemId: purchase.course,
      amountPaid: purchase.amount,
    }).catch(() => {});
    return { ok: true, purchaseType: "course", itemId: purchase.course };
  }

  const purchase = await findWorkshopPurchaseForVerify(studentId, sessionId, itemId);
  if (!purchase) return { ok: false, reason: "purchase_not_found" };
  if (purchase.status === "paid") {
    await creditAffiliateForWorkshop(purchase);
    return { ok: true, alreadyPaid: true, purchaseType: "workshop", itemId: purchase.workshop };
  }

  await finalizePaidPurchase(purchase, sessionId, paymentId);
  await grantWorkshopAccess(studentId, purchase.workshop);
  await creditAffiliateForWorkshop(purchase);
  notifyEnrollmentSuccess({
    studentId,
    purchaseType: "workshop",
    itemId: purchase.workshop,
    amountPaid: purchase.amount,
  }).catch(() => {});
  return { ok: true, purchaseType: "workshop", itemId: purchase.workshop };
};

export const markZohoPaymentFailed = async ({ sessionId, studentId, itemId, purchaseType }) => {
  const Model = purchaseType === "course" ? CoursePurchase : WorkshopPurchase;
  const itemField = purchaseType === "course" ? "course" : "workshop";

  const purchase = await Model.findOne({
    student: studentId,
    [itemField]: itemId,
    $or: [{ paymentOrderId: sessionId }, { status: "pending" }],
  });

  if (purchase && purchase.status === "pending") {
    purchase.status = "failed";
    await purchase.save();
  }
};

/** Credit affiliate after free/referral enrollment of a paid product */
export const fulfillAffiliateOnEnrollment = async (purchase, purchaseType) => {
  if (purchaseType === "course") {
    await creditAffiliateForCourse(purchase);
  } else {
    await creditAffiliateForWorkshop(purchase);
  }
};
