import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";
import {
  getDashboard,
  getMyBatches,
  getMyClasses,
  joinClass,
  updateClassStatus,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  gradeSubmission,
  getMeetingRequests,
  respondMeetingRequest,
} from "../controllers/tutor/tutorController.js";

const router = express.Router();

router.use(protect, authorize(ROLES.TUTOR));

router.get("/dashboard", getDashboard);
router.get("/batches", getMyBatches);
router.get("/classes", getMyClasses);
router.get("/classes/:id/join", joinClass);
router.patch("/classes/:id/status", updateClassStatus);

router.get("/assignments", getAssignments);
router.post("/assignments", createAssignment);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);
router.get("/assignments/:id/submissions", getSubmissions);
router.put("/assignments/:assignmentId/submissions/:submissionId/grade", gradeSubmission);

router.get("/meeting-requests", getMeetingRequests);
router.patch("/meeting-requests/:id", respondMeetingRequest);

export default router;
