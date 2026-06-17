import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";
import User from "../models/User.js";
import {
  getPayPalClientId,
  getPayPalMode,
  isPayPalConfigured,
} from "../config/paypal.js";
import {
  captureOrGetCompletedPayPalOrder,
  createPayPalOrder,
  getPayPalCaptureId,
} from "../utils/paypalClient.js";
import { isEnrollmentClosed } from "../utils/courseEnrollment.js";
import { isRegistrationClosed } from "../utils/workshopRegistration.js";
import { isFreePrice } from "../utils/pricing.js";
import {
  upsertPendingCoursePurchase,
  upsertPendingWorkshopPurchase,
  findCoursePurchaseForVerify,
  findWorkshopPurchaseForVerify,
} from "../utils/paymentPurchase.js";

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

export const getPaymentConfig = async (req, res) => {
  const clientId = getPayPalClientId();
  const enabled = isPayPalConfigured();
  res.json({
    success: true,
    data: {
      clientId: enabled ? clientId : "",
      enabled,
      provider: "paypal",
      testMode: enabled && getPayPalMode() === "sandbox",
    },
  });
};

const createGatewayOrder = async (amount, currency, description, customId) => {
  const order = await createPayPalOrder({
    amount,
    currency,
    description,
    customId,
  });
  return order;
};

export const createCourseOrder = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course || course.status !== "published") {
      return res.status(404).json({ success: false, message: "Course not available." });
    }

    if (isEnrollmentClosed(course)) {
      return res.status(400).json({
        success: false,
        message: "Enrollment for this course has closed.",
        data: { enrollmentClosed: true },
      });
    }

    const existing = await CoursePurchase.findOne({
      student: req.user._id,
      course: course._id,
      status: "paid",
    });
    if (existing) {
      await grantCourseAccess(req.user._id, course._id);
      return res.json({
        success: true,
        message: "You have already purchased this course.",
        data: { alreadyPurchased: true, hasAccess: true },
      });
    }

    if (isFreePrice(course)) {
      await CoursePurchase.findOneAndUpdate(
        { student: req.user._id, course: course._id },
        {
          student: req.user._id,
          course: course._id,
          amount: 0,
          status: "paid",
          paymentGateway: "free",
        },
        { upsert: true, new: true }
      );
      await grantCourseAccess(req.user._id, course._id);
      return res.json({
        success: true,
        data: { free: true, message: "Course enrolled for free." },
      });
    }

    const order = await createGatewayOrder(
      course.price,
      course.currency,
      course.title,
      `course:${course._id}:${req.user._id}`
    );

    await upsertPendingCoursePurchase(req.user._id, course, order.id);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: course.price,
        currency: order.purchase_units?.[0]?.amount?.currency_code || course.currency || "INR",
        clientId: getPayPalClientId(),
        item: { _id: course._id, title: course.title, price: course.price },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const createWorkshopOrder = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.workshopId);
    if (!workshop || ["cancelled", "completed"].includes(workshop.status)) {
      return res.status(404).json({ success: false, message: "Event not available." });
    }

    if (isRegistrationClosed(workshop)) {
      return res.status(400).json({
        success: false,
        message: "Registration for this event has closed.",
        data: { registrationClosed: true },
      });
    }

    const existing = await WorkshopPurchase.findOne({
      student: req.user._id,
      workshop: workshop._id,
      status: "paid",
    });
    if (existing) {
      await grantWorkshopAccess(req.user._id, workshop._id);
      return res.json({
        success: true,
        message: "You are already registered for this event.",
        data: { alreadyRegistered: true, hasAccess: true },
      });
    }

    if (isFreePrice(workshop)) {
      await WorkshopPurchase.findOneAndUpdate(
        { student: req.user._id, workshop: workshop._id },
        {
          student: req.user._id,
          workshop: workshop._id,
          amount: 0,
          status: "paid",
          paymentGateway: "free",
        },
        { upsert: true, new: true }
      );
      await grantWorkshopAccess(req.user._id, workshop._id);
      return res.json({
        success: true,
        data: { free: true, message: "Registered for free." },
      });
    }

    const order = await createGatewayOrder(
      workshop.price,
      workshop.currency,
      workshop.title,
      `workshop:${workshop._id}:${req.user._id}`
    );

    await upsertPendingWorkshopPurchase(req.user._id, workshop, order.id);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: workshop.price,
        currency: order.purchase_units?.[0]?.amount?.currency_code || workshop.currency || "INR",
        clientId: getPayPalClientId(),
        item: { _id: workshop._id, title: workshop.title, price: workshop.price },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const finalizePaidPurchase = async (purchase, orderId, captureId) => {
  if (purchase.status !== "paid") {
    purchase.status = "paid";
    purchase.paymentGateway = "paypal";
    purchase.paymentOrderId = orderId;
    purchase.paymentTransactionId = captureId;
    await purchase.save();
  }
};

export const verifyCoursePayment = async (req, res) => {
  try {
    const { orderId, courseId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing PayPal order ID." });
    }

    const purchase = await findCoursePurchaseForVerify(req.user._id, orderId, courseId);

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (purchase.status !== "paid") {
      if (!isPayPalConfigured()) {
        return res.status(503).json({ success: false, message: "Payment not configured." });
      }

      const captured = await captureOrGetCompletedPayPalOrder(orderId);
      if (captured.status !== "COMPLETED") {
        return res.status(400).json({ success: false, message: "Payment was not completed." });
      }

      await finalizePaidPurchase(purchase, orderId, getPayPalCaptureId(captured));
    }

    await grantCourseAccess(req.user._id, purchase.course);

    const course = await Course.findById(purchase.course).select("title thumbnail price");

    res.json({
      success: true,
      message: "Payment successful. Course access granted.",
      data: { purchase, item: course, itemType: "course" },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyWorkshopPayment = async (req, res) => {
  try {
    const { orderId, workshopId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing PayPal order ID." });
    }

    const purchase = await findWorkshopPurchaseForVerify(req.user._id, orderId, workshopId);

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (purchase.status !== "paid") {
      if (!isPayPalConfigured()) {
        return res.status(503).json({ success: false, message: "Payment not configured." });
      }

      const captured = await captureOrGetCompletedPayPalOrder(orderId);
      if (captured.status !== "COMPLETED") {
        return res.status(400).json({ success: false, message: "Payment was not completed." });
      }

      await finalizePaidPurchase(purchase, orderId, getPayPalCaptureId(captured));
    }

    await grantWorkshopAccess(req.user._id, purchase.workshop);

    const workshop = await Workshop.findById(purchase.workshop).select(
      "title price eventType meetLink date"
    );

    res.json({
      success: true,
      message: "Payment successful. You are registered for this event.",
      data: { purchase, item: workshop, itemType: "workshop" },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyPurchases = async (req, res) => {
  try {
    const [courses, workshops] = await Promise.all([
      CoursePurchase.find({ student: req.user._id, status: "paid" }).populate(
        "course",
        "title thumbnail price category"
      ),
      WorkshopPurchase.find({ student: req.user._id, status: "paid" }).populate(
        "workshop",
        "title price eventType date"
      ),
    ]);
    res.json({ success: true, data: { courses, workshops } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkCourseAccess = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const purchase = await CoursePurchase.findOne({
      student: req.user._id,
      course: courseId,
      status: "paid",
    });
    const hasAccess =
      Boolean(purchase) ||
      (req.user.enrolledCourses || []).map(String).includes(String(courseId));

    res.json({ success: true, data: { hasAccess, purchased: Boolean(purchase) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkWorkshopAccess = async (req, res) => {
  try {
    const workshopId = req.params.workshopId;
    const purchase = await WorkshopPurchase.findOne({
      student: req.user._id,
      workshop: workshopId,
      status: "paid",
    });
    const hasAccess =
      Boolean(purchase) ||
      (req.user.registeredWorkshops || []).map(String).includes(String(workshopId));

    res.json({ success: true, data: { hasAccess, registered: Boolean(purchase) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
