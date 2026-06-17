import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";
import {
  getMyAssignments,
  submitAssignment,
  requestMeeting,
  getMyMeetingRequests,
  getMyTutors,
} from "../controllers/student/studentPortalController.js";
import {
  getEnrollmentStatus,
  getMyCourses,
  getCourseDashboard,
  getProgress,
  getProfile,
  updateProfile,
  getResumeData,
  getCareerJobs,
} from "../controllers/student/studentPhase4Controller.js";
import {
  applyToJob,
  getMyApplications,
} from "../controllers/student/jobApplicationController.js";

const router = express.Router();

router.use(protect, authorize(ROLES.STUDENT));

router.get("/enrollment-status", getEnrollmentStatus);
router.get("/my-courses", getMyCourses);
router.get("/my-courses/:batchId", getCourseDashboard);
router.get("/progress", getProgress);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/resume", getResumeData);
router.get("/career/jobs", getCareerJobs);
router.post("/career/jobs/:jobId/apply", applyToJob);
router.get("/career/applications", getMyApplications);

router.get("/assignments", getMyAssignments);
router.post("/assignments/:id/submit", submitAssignment);
router.get("/tutors", getMyTutors);
router.get("/meeting-requests", getMyMeetingRequests);
router.post("/meeting-requests", requestMeeting);

export default router;
