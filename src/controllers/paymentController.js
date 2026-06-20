import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import CoursePurchase from "../models/CoursePurchase.js";
import WorkshopPurchase from "../models/WorkshopPurchase.js";
import User from "../models/User.js";
import { getZohoRedirectBase, isZohoPaymentsConfigured, hasZohoOAuthCredentials, buildZohoAuthorizationUrl, getZohoOAuthRedirectUri, getZohoRefreshToken } from "../config/zohoPayments.js";
import {
  createZohoPaymentSession,
  verifyZohoHostedCheckoutSignature,
  exchangeZohoAuthorizationCode,
} from "../utils/zohoPaymentsClient.js";
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

const hasCourseAccess = async (student, courseId) => {
  const alreadyInProfile = (student?.enrolledCourses || [])
    .map(String)
    .includes(String(courseId));
  if (alreadyInProfile) return true;

  const paidPurchase = await CoursePurchase.exists({
    student: student?._id,
    course: courseId,
    status: "paid",
  });
  return Boolean(paidPurchase);
};

const hasWorkshopAccess = async (student, workshopId) => {
  const alreadyInProfile = (student?.registeredWorkshops || [])
    .map(String)
    .includes(String(workshopId));
  if (alreadyInProfile) return true;

  const paidPurchase = await WorkshopPurchase.exists({
    student: student?._id,
    workshop: workshopId,
    status: "paid",
  });
  return Boolean(paidPurchase);
};

const buildReturnUrls = () => {
  const base = getZohoRedirectBase();
  return {
    successUrl: `${base}/payment/return?outcome=success`,
    failureUrl: `${base}/payment/return?outcome=failure`,
  };
};

export const getPaymentConfig = async (req, res) => {
  const enabled = isZohoPaymentsConfigured();
  res.json({
    success: true,
    data: {
      enabled,
      provider: "zoho",
      currency: "INR",
      needsRefreshToken: hasZohoOAuthCredentials() && !enabled,
    },
  });
};

export const getZohoOAuthSetup = async (req, res) => {
  try {
    if (!hasZohoOAuthCredentials()) {
      return res.status(503).json({
        success: false,
        message:
          "Add ZOHO_PAYMENTS_CLIENT_ID, CLIENT_SECRET, ACCOUNT_ID, and SIGNING_KEY to backend env first.",
      });
    }

    res.json({
      success: true,
      data: {
        authorizationUrl: buildZohoAuthorizationUrl(),
        redirectUri: getZohoOAuthRedirectUri(),
        configured: isZohoPaymentsConfigured(),
        needsRefreshToken: !getZohoRefreshToken(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exchangeZohoOAuthCode = async (req, res) => {
  try {
    const { code } = req.body || {};
    const result = await exchangeZohoAuthorizationCode(code);

    res.json({
      success: true,
      message:
        "Copy the refresh token below into ZOHO_PAYMENTS_REFRESH_TOKEN on Render, then redeploy the backend.",
      data: {
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    res.status(error.status || 400).json({
      success: false,
      message: error.message || "Could not exchange authorization code.",
    });
  }
};

const createGatewaySession = async (item, purchaseType, student) => {
  const { successUrl, failureUrl } = buildReturnUrls();
  return createZohoPaymentSession({
    amount: item.price,
    currency: item.currency || "INR",
    description: item.title,
    email: student.email,
    phone: student.phone || "",
    successUrl,
    failureUrl,
    udf1: purchaseType,
    udf2: String(item._id),
    udf3: String(student._id),
  });
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

    const alreadyPurchased = await hasCourseAccess(req.user, course._id);
    if (alreadyPurchased) {
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

    const session = await createGatewaySession(course, "course", req.user);
    await upsertPendingCoursePurchase(req.user._id, course, session.sessionId);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        amount: course.price,
        currency: course.currency || "INR",
        item: { _id: course._id, title: course.title, price: course.price },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Payment failed.",
    });
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

    const alreadyRegistered = await hasWorkshopAccess(req.user, workshop._id);
    if (alreadyRegistered) {
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

    const session = await createGatewaySession(workshop, "workshop", req.user);
    await upsertPendingWorkshopPurchase(req.user._id, workshop, session.sessionId);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        amount: workshop.price,
        currency: workshop.currency || "INR",
        item: { _id: workshop._id, title: workshop.title, price: workshop.price },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Payment failed.",
    });
  }
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

const processZohoReturn = async (req, res, purchaseType) => {
  const params = req.body;
  const {
    payments_session_id: sessionId,
    payment_session_status: sessionStatus,
    payment_id: paymentId,
    payment_status: paymentStatus,
    udf2: itemId,
    udf3: studentId,
  } = params;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: "Missing payment session ID." });
  }

  if (String(studentId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "Payment does not belong to this account." });
  }

  if (!verifyZohoHostedCheckoutSignature(params)) {
    return res.status(400).json({ success: false, message: "Invalid payment signature." });
  }

  const succeeded =
    sessionStatus === "succeeded" ||
    paymentStatus === "succeeded" ||
    sessionStatus === "in_progress";

  if (!succeeded && params.outcome === "failure") {
    return res.status(400).json({
      success: false,
      message: "Payment was not completed.",
      data: { failed: true },
    });
  }

  if (sessionStatus === "failed" || paymentStatus === "failed") {
    return res.status(400).json({
      success: false,
      message: "Payment failed.",
      data: { failed: true },
    });
  }

  if (purchaseType === "course") {
    const purchase = await findCoursePurchaseForVerify(req.user._id, sessionId, itemId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    await finalizePaidPurchase(purchase, sessionId, paymentId);
    await grantCourseAccess(req.user._id, purchase.course);

    const course = await Course.findById(purchase.course).select("title thumbnail price");
    return res.json({
      success: true,
      message: "Payment successful. Course access granted.",
      data: { purchase, item: course, itemType: "course" },
    });
  }

  const purchase = await findWorkshopPurchaseForVerify(req.user._id, sessionId, itemId);
  if (!purchase) {
    return res.status(404).json({ success: false, message: "Order not found." });
  }

  await finalizePaidPurchase(purchase, sessionId, paymentId);
  await grantWorkshopAccess(req.user._id, purchase.workshop);

  const workshop = await Workshop.findById(purchase.workshop).select(
    "title price eventType meetLink date"
  );

  return res.json({
    success: true,
    message: "Payment successful. You are registered for this event.",
    data: { purchase, item: workshop, itemType: "workshop" },
  });
};

export const verifyCoursePayment = async (req, res) => {
  try {
    return await processZohoReturn(req, res, "course");
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyWorkshopPayment = async (req, res) => {
  try {
    return await processZohoReturn(req, res, "workshop");
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
