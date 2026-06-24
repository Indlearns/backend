import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";
import User from "../models/User.js";
import {
  findCoursePurchaseForVerify,
  findWorkshopPurchaseForVerify,
} from "./paymentPurchase.js";

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

const finalizePaidPurchase = async (purchase, sessionId, paymentId) => {
  if (purchase.status !== "paid") {
    purchase.status = "paid";
    purchase.paymentGateway = "zoho";
    purchase.paymentOrderId = sessionId;
    purchase.paymentTransactionId = paymentId || "";
    await purchase.save();
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
      return { ok: true, alreadyPaid: true, purchaseType: "course", itemId: purchase.course };
    }

    await finalizePaidPurchase(purchase, sessionId, paymentId);
    await grantCourseAccess(studentId, purchase.course);
    return { ok: true, purchaseType: "course", itemId: purchase.course };
  }

  const purchase = await findWorkshopPurchaseForVerify(studentId, sessionId, itemId);
  if (!purchase) return { ok: false, reason: "purchase_not_found" };
  if (purchase.status === "paid") {
    return { ok: true, alreadyPaid: true, purchaseType: "workshop", itemId: purchase.workshop };
  }

  await finalizePaidPurchase(purchase, sessionId, paymentId);
  await grantWorkshopAccess(studentId, purchase.workshop);
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
