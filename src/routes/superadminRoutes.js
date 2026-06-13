import express from "express";
import {
  createAdmin,
  createTutor,
  getAdmins,
  getTutors,
  resetStaffPassword,
  toggleStaffActive,
} from "../controllers/superadminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";

const router = express.Router();

router.use(protect);
router.use(authorize(ROLES.SUPERADMIN));

router.post("/admins", createAdmin);
router.get("/admins", getAdmins);
router.post("/tutors", createTutor);
router.get("/tutors", getTutors);

router.post("/admins/:id/reset-password", (req, res, next) => {
  req.params.role = "admins";
  resetStaffPassword(req, res, next);
});
router.post("/tutors/:id/reset-password", (req, res, next) => {
  req.params.role = "tutors";
  resetStaffPassword(req, res, next);
});
router.patch("/admins/:id/toggle-active", (req, res, next) => {
  req.params.role = "admins";
  toggleStaffActive(req, res, next);
});
router.patch("/tutors/:id/toggle-active", (req, res, next) => {
  req.params.role = "tutors";
  toggleStaffActive(req, res, next);
});

export default router;
