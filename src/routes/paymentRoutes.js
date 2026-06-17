import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireStudentForPayment } from "../middleware/paymentMiddleware.js";
import {
  getPaymentConfig,
  createCourseOrder,
  createWorkshopOrder,
  verifyCoursePayment,
  verifyWorkshopPayment,
  getMyPurchases,
  checkCourseAccess,
  checkWorkshopAccess,
} from "../controllers/paymentController.js";

const router = express.Router();

router.get("/config", getPaymentConfig);

router.use(protect, requireStudentForPayment);

router.get("/my-purchases", getMyPurchases);
router.get("/course/:courseId/access", checkCourseAccess);
router.get("/workshop/:workshopId/access", checkWorkshopAccess);
router.post("/course/:courseId/create-order", createCourseOrder);
router.post("/workshop/:workshopId/create-order", createWorkshopOrder);
router.post("/verify", verifyCoursePayment);
router.post("/verify/workshop", verifyWorkshopPayment);

export default router;
