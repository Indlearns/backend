import express from "express";
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import {
  requestSuperAdminCode,
  verifySuperAdminCode,
} from "../controllers/superadminAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/superadmin/request-code", requestSuperAdminCode);
router.post("/superadmin/verify-code", verifySuperAdminCode);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

export default router;
