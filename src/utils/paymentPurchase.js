import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";

const orderLookup = (orderId) => ({
  $or: [{ paymentOrderId: orderId }, { razorpayOrderId: orderId }],
});

export const upsertPendingCoursePurchase = async (studentId, course, orderId) => {
  return CoursePurchase.findOneAndUpdate(
    { student: studentId, course: course._id },
    {
      student: studentId,
      course: course._id,
      amount: course.price,
      currency: course.currency || "INR",
      paymentGateway: "zoho",
      paymentOrderId: orderId,
      paymentTransactionId: "",
      razorpayOrderId: "",
      razorpayPaymentId: "",
      razorpaySignature: "",
      status: "pending",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const upsertPendingWorkshopPurchase = async (studentId, workshop, orderId) => {
  return WorkshopPurchase.findOneAndUpdate(
    { student: studentId, workshop: workshop._id },
    {
      student: studentId,
      workshop: workshop._id,
      amount: workshop.price,
      currency: workshop.currency || "INR",
      paymentGateway: "zoho",
      paymentOrderId: orderId,
      paymentTransactionId: "",
      razorpayOrderId: "",
      razorpayPaymentId: "",
      razorpaySignature: "",
      status: "pending",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const findCoursePurchaseForVerify = async (studentId, orderId, courseId) => {
  let purchase = await CoursePurchase.findOne({
    student: studentId,
    ...orderLookup(orderId),
  });

  if (!purchase && courseId) {
    purchase = await CoursePurchase.findOne({
      student: studentId,
      course: courseId,
    });
  }

  return purchase;
};

export const findWorkshopPurchaseForVerify = async (studentId, orderId, workshopId) => {
  let purchase = await WorkshopPurchase.findOne({
    student: studentId,
    ...orderLookup(orderId),
  });

  if (!purchase && workshopId) {
    purchase = await WorkshopPurchase.findOne({
      student: studentId,
      workshop: workshopId,
    });
  }

  return purchase;
};
