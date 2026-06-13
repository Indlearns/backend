import crypto from "crypto";
import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";
import User from "../models/User.js";
import {
  getRazorpay,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  isRazorpayConfigured,
} from "../config/razorpay.js";
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

export const getRazorpayConfig = async (req, res) => {
  const keyId = getRazorpayKeyId();
  const enabled = isRazorpayConfigured();
  res.json({
    success: true,
    data: {
      keyId: enabled ? keyId : "",
      enabled,
      testMode: enabled && keyId.startsWith("rzp_test_"),
    },
  });
};

const createRazorpayOrder = async (amountRupees, currency, receipt, notes) => {
  const razorpay = getRazorpay();
  if (!razorpay) {
    const err = new Error("Payment gateway is not configured. Add Razorpay keys to backend .env");
    err.status = 503;
    throw err;
  }
  const amountPaise = Math.round(amountRupees * 100);
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: currency || "INR",
    receipt,
    notes,
  });
  return { order, amountPaise };
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
        },
        { upsert: true, new: true }
      );
      await grantCourseAccess(req.user._id, course._id);
      return res.json({
        success: true,
        data: { free: true, message: "Course enrolled for free." },
      });
    }

    const { order, amountPaise } = await createRazorpayOrder(
      course.price,
      course.currency,
      `course_${course._id.toString().slice(-8)}_${Date.now()}`,
      {
        type: "course",
        courseId: String(course._id),
        studentId: String(req.user._id),
        title: course.title,
      }
    );

    await upsertPendingCoursePurchase(req.user._id, course, order.id);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountPaise,
        currency: order.currency,
        keyId: getRazorpayKeyId(),
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
        },
        { upsert: true, new: true }
      );
      await grantWorkshopAccess(req.user._id, workshop._id);
      return res.json({
        success: true,
        data: { free: true, message: "Registered for free." },
      });
    }

    const { order, amountPaise } = await createRazorpayOrder(
      workshop.price,
      workshop.currency,
      `event_${workshop._id.toString().slice(-8)}_${Date.now()}`,
      {
        type: "workshop",
        workshopId: String(workshop._id),
        studentId: String(req.user._id),
        title: workshop.title,
      }
    );

    await upsertPendingWorkshopPurchase(req.user._id, workshop, order.id);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountPaise,
        currency: order.currency,
        keyId: getRazorpayKeyId(),
        item: { _id: workshop._id, title: workshop.title, price: workshop.price },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const verifyCoursePayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment details." });
    }

    const purchase = await findCoursePurchaseForVerify(
      req.user._id,
      razorpay_order_id,
      courseId
    );

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (purchase.status !== "paid") {
      const secret = getRazorpayKeySecret();
      if (!secret) {
        return res.status(503).json({ success: false, message: "Payment not configured." });
      }

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

      if (expected !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Invalid payment signature." });
      }

      purchase.status = "paid";
      purchase.razorpayOrderId = razorpay_order_id;
      purchase.razorpayPaymentId = razorpay_payment_id;
      purchase.razorpaySignature = razorpay_signature;
      await purchase.save();
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, workshopId } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment details." });
    }

    const purchase = await findWorkshopPurchaseForVerify(
      req.user._id,
      razorpay_order_id,
      workshopId
    );

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (purchase.status !== "paid") {
      const secret = getRazorpayKeySecret();
      if (!secret) {
        return res.status(503).json({ success: false, message: "Payment not configured." });
      }

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

      if (expected !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Invalid payment signature." });
      }

      purchase.status = "paid";
      purchase.razorpayOrderId = razorpay_order_id;
      purchase.razorpayPaymentId = razorpay_payment_id;
      purchase.razorpaySignature = razorpay_signature;
      await purchase.save();
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
