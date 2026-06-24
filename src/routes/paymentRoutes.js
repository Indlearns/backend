import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { requireStudentForPayment } from "../middleware/paymentMiddleware.js";
import { ROLES } from "../config/roleConfig.js";
import {
  getPaymentConfig,
  getZohoOAuthSetup,
  exchangeZohoOAuthCode,
  zohoWebhookPing,
  handleZohoWebhook,
  createCourseOrder,
  createWorkshopOrder,
  validateCourseReferralCode,
  verifyCoursePayment,
  verifyWorkshopPayment,
  getMyPurchases,
  checkCourseAccess,
  checkWorkshopAccess,
} from "../controllers/paymentController.js";

const router = express.Router();

router.get("/config", getPaymentConfig);

router.get("/zoho/webhook", zohoWebhookPing);
router.head("/zoho/webhook", zohoWebhookPing);
router.post("/zoho/webhook", handleZohoWebhook);

router.get("/zoho/setup", protect, authorize(ROLES.SUPERADMIN), getZohoOAuthSetup);
router.post("/zoho/exchange-code", protect, authorize(ROLES.SUPERADMIN), exchangeZohoOAuthCode);

router.use(protect, requireStudentForPayment);

router.get("/my-purchases", getMyPurchases);
router.get("/course/:courseId/access", checkCourseAccess);
router.get("/workshop/:workshopId/access", checkWorkshopAccess);
router.post("/course/:courseId/validate-referral", validateCourseReferralCode);
router.post("/course/:courseId/create-order", createCourseOrder);
router.post("/workshop/:workshopId/create-order", createWorkshopOrder);
router.post("/verify", verifyCoursePayment);
router.post("/verify/workshop", verifyWorkshopPayment);

export default router;
