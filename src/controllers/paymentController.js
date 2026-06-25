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
  verifyZohoWebhookSignature,
  getZohoPaymentSession,
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
import { fulfillZohoPayment, markZohoPaymentFailed } from "../utils/paymentFulfillment.js";
import {
  validateReferralForCourse,
  validateReferralForWorkshop,
  validateReferralForItem,
  incrementReferralUsage,
} from "../utils/referralCode.js";
import { notifyEnrollmentSuccess } from "../utils/enrollmentEmail.js";

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

const completeEnrollment = async (studentId, purchaseType, itemId, amountPaid = 0) => {
  if (purchaseType === "course") {
    await grantCourseAccess(studentId, itemId);
  } else {
    await grantWorkshopAccess(studentId, itemId);
  }
  notifyEnrollmentSuccess({ studentId, purchaseType, itemId, amountPaid }).catch(() => {});
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

const createGatewaySession = async (item, purchaseType, student, { amount } = {}) => {
  const { successUrl, failureUrl } = buildReturnUrls();
  return createZohoPaymentSession({
    amount: amount ?? item.price,
    currency: item.currency || "INR",
    description: item.title,
    email: student.email,
    phone: student.phone || "",
    name: student.name || "",
    successUrl,
    failureUrl,
    udf1: purchaseType,
    udf2: String(item._id),
    udf3: String(student._id),
  });
};

const resolveReferralForOrder = async (referralInput, item) => {
  const pricing = {
    originalAmount: item.price,
    discountAmount: 0,
    finalAmount: item.price,
  };
  let referralMeta = {};

  if (!referralInput?.trim()) {
    return { ok: true, pricing, referralMeta };
  }

  const validated = await validateReferralForItem(referralInput, item);
  if (!validated.ok) return validated;

  return {
    ok: true,
    pricing: validated.pricing,
    referralMeta: {
      referralCode: validated.referral.code,
      referralCodeId: validated.referral._id,
    },
  };
};

const referralSuccessPayload = (pricing, referralMeta) => ({
  originalAmount: pricing.originalAmount,
  discountAmount: pricing.discountAmount,
  finalAmount: pricing.finalAmount,
  referralCode: referralMeta.referralCode || "",
});

export const validateCourseReferralCode = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course || course.status !== "published") {
      return res.status(404).json({ success: false, message: "Course not available." });
    }

    if (isFreePrice(course)) {
      return res.status(400).json({
        success: false,
        message: "Referral codes apply to paid courses only.",
      });
    }

    const result = await validateReferralForCourse(req.body?.referralCode, course);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        referralCode: result.referral.code,
        originalAmount: result.pricing.originalAmount,
        discountAmount: result.pricing.discountAmount,
        finalAmount: result.pricing.finalAmount,
        currency: course.currency || "INR",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const validateWorkshopReferralCode = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.workshopId);
    if (!workshop || ["cancelled", "completed"].includes(workshop.status)) {
      return res.status(404).json({ success: false, message: "Event not available." });
    }

    if (isFreePrice(workshop)) {
      return res.status(400).json({
        success: false,
        message: "Referral codes apply to paid events only.",
      });
    }

    const result = await validateReferralForWorkshop(req.body?.referralCode, workshop);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        referralCode: result.referral.code,
        originalAmount: result.pricing.originalAmount,
        discountAmount: result.pricing.discountAmount,
        finalAmount: result.pricing.finalAmount,
        currency: workshop.currency || "INR",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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
      await completeEnrollment(req.user._id, "course", course._id, 0);
      return res.json({
        success: true,
        data: { free: true, message: "Course enrolled for free." },
      });
    }

    const referralInput = req.body?.referralCode?.trim();
    const referralResult = await resolveReferralForOrder(referralInput, course);
    if (!referralResult.ok) {
      return res.status(400).json({ success: false, message: referralResult.message });
    }
    const { pricing, referralMeta } = referralResult;

    if (isFreePrice({ price: pricing.finalAmount })) {
      await CoursePurchase.findOneAndUpdate(
        { student: req.user._id, course: course._id },
        {
          student: req.user._id,
          course: course._id,
          amount: 0,
          originalAmount: pricing.originalAmount,
          discountAmount: pricing.discountAmount,
          referralCode: referralMeta.referralCode || "",
          referralCodeRef: referralMeta.referralCodeId || null,
          status: "paid",
          paymentGateway: referralMeta.referralCode ? "referral" : "free",
        },
        { upsert: true, new: true }
      );
      if (referralMeta.referralCodeId) {
        await incrementReferralUsage(referralMeta.referralCodeId);
      }
      await completeEnrollment(req.user._id, "course", course._id, pricing.finalAmount);
      return res.json({
        success: true,
        data: {
          free: true,
          message: "Course enrolled with referral discount (no payment required).",
          ...referralSuccessPayload(pricing, referralMeta),
        },
      });
    }

    const session = await createGatewaySession(course, "course", req.user, {
      amount: pricing.finalAmount,
    });
    await upsertPendingCoursePurchase(req.user._id, course, session.sessionId, {
      ...pricing,
      ...referralMeta,
    });

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        amount: pricing.finalAmount,
        originalAmount: pricing.originalAmount,
        discountAmount: pricing.discountAmount,
        referralCode: referralMeta.referralCode || "",
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
      await completeEnrollment(req.user._id, "workshop", workshop._id, 0);
      return res.json({
        success: true,
        data: { free: true, message: "Registered for free." },
      });
    }

    const referralInput = req.body?.referralCode?.trim();
    const referralResult = await resolveReferralForOrder(referralInput, workshop);
    if (!referralResult.ok) {
      return res.status(400).json({ success: false, message: referralResult.message });
    }
    const { pricing, referralMeta } = referralResult;

    if (isFreePrice({ price: pricing.finalAmount })) {
      await WorkshopPurchase.findOneAndUpdate(
        { student: req.user._id, workshop: workshop._id },
        {
          student: req.user._id,
          workshop: workshop._id,
          amount: 0,
          originalAmount: pricing.originalAmount,
          discountAmount: pricing.discountAmount,
          referralCode: referralMeta.referralCode || "",
          referralCodeRef: referralMeta.referralCodeId || null,
          status: "paid",
          paymentGateway: referralMeta.referralCode ? "referral" : "free",
        },
        { upsert: true, new: true }
      );
      if (referralMeta.referralCodeId) {
        await incrementReferralUsage(referralMeta.referralCodeId);
      }
      await completeEnrollment(req.user._id, "workshop", workshop._id, pricing.finalAmount);
      return res.json({
        success: true,
        data: {
          free: true,
          message: "Registered with referral discount (no payment required).",
          ...referralSuccessPayload(pricing, referralMeta),
        },
      });
    }

    const session = await createGatewaySession(workshop, "workshop", req.user, {
      amount: pricing.finalAmount,
    });
    await upsertPendingWorkshopPurchase(req.user._id, workshop, session.sessionId, {
      ...pricing,
      ...referralMeta,
    });

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        amount: pricing.finalAmount,
        originalAmount: pricing.originalAmount,
        discountAmount: pricing.discountAmount,
        referralCode: referralMeta.referralCode || "",
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

    const result = await fulfillZohoPayment({
      sessionId,
      paymentId,
      purchaseType: "course",
      itemId,
      studentId: req.user._id,
    });

    if (!result.ok) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

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

  const result = await fulfillZohoPayment({
    sessionId,
    paymentId,
    purchaseType: "workshop",
    itemId,
    studentId: req.user._id,
  });

  if (!result.ok) {
    return res.status(404).json({ success: false, message: "Order not found." });
  }

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

/** Zoho pings this URL (often GET) when registering the webhook — must return 200. */
export const zohoWebhookPing = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Zoho Payments webhook endpoint is ready.",
  });
};

const resolveWebhookContext = async (sessionId) => {
  const session = await getZohoPaymentSession(sessionId);
  const hosted =
    session?.configurations?.hosted_checkout_parameters ||
    session?.configurations?.hosted_page_parameters ||
    {};

  return {
    purchaseType: hosted.udf1 === "workshop" ? "workshop" : "course",
    itemId: hosted.udf2 || "",
    studentId: hosted.udf3 || "",
  };
};

export const handleZohoWebhook = async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const signatureHeader =
    req.headers["x-zoho-webhook-signature"] || req.headers["X-Zoho-Webhook-Signature"];

  if (!verifyZohoWebhookSignature(rawBody, signatureHeader)) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature." });
  }

  let payload = req.body;
  if (!payload || typeof payload !== "object" || !Object.keys(payload).length) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid webhook payload." });
    }
  }

  res.status(200).json({ success: true, received: true });

  const eventType = payload.event_type || "";
  const payment = payload.event_object?.payment || {};
  const sessionId = payment.payments_session_id || payment.payment_session_id || "";
  const paymentId = payment.payment_id || "";

  if (!sessionId) return;

  try {
    const { purchaseType, itemId, studentId } = await resolveWebhookContext(sessionId);
    if (!itemId || !studentId) return;

    if (eventType === "payment.succeeded" || payment.status === "succeeded") {
      await fulfillZohoPayment({ sessionId, paymentId, purchaseType, itemId, studentId });
      return;
    }

    if (eventType === "payment.failed" || payment.status === "failed") {
      await markZohoPaymentFailed({ sessionId, studentId, itemId, purchaseType });
    }
  } catch (error) {
    console.error("Zoho webhook processing error:", error.message);
  }
};
