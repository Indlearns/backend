import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";
import {
  getPartnerDashboard,
  getPartnerJobs,
  createPartnerJob,
  updatePartnerJob,
  deletePartnerJob,
  getPartnerApplications,
  getPartnerApplicationDetail,
  updateApplicationStatus,
} from "../controllers/partner/partnerController.js";

const router = express.Router();

router.use(protect, authorize(ROLES.PARTNER));

router.get("/dashboard", getPartnerDashboard);
router.get("/jobs", getPartnerJobs);
router.post("/jobs", createPartnerJob);
router.put("/jobs/:id", updatePartnerJob);
router.delete("/jobs/:id", deletePartnerJob);
router.get("/applications", getPartnerApplications);
router.get("/applications/:id", getPartnerApplicationDetail);
router.patch("/applications/:id/status", updateApplicationStatus);

export default router;
