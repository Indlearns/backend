import express from "express";
import { staffAuth } from "../middleware/staffMiddleware.js";
import { getDashboard } from "../controllers/admin/dashboardController.js";
import { createTutor, getTutors } from "../controllers/admin/tutorController.js";
import {
  getStudents,
  getStudentById,
  getEnrollmentsByCourse,
  exportAllEnrollments,
} from "../controllers/admin/studentController.js";
import {
  createCourse,
  getCourses,
  updateCourse,
  deleteCourse,
  getCourseEnrollments,
  exportCourseEnrollments,
} from "../controllers/admin/courseController.js";
import { uploadCourseImage } from "../middleware/uploadMiddleware.js";
import {
  createWorkshop,
  getWorkshops,
  updateWorkshop,
  deleteWorkshop,
} from "../controllers/admin/workshopController.js";
import {
  createPartnerCompany,
  getCompanies,
  updateCompany,
  deleteCompany,
} from "../controllers/admin/companyController.js";
import {
  createBatch,
  getBatches,
  updateBatch,
  deleteBatch,
} from "../controllers/admin/batchController.js";
import {
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  deleteScheduleGroup,
} from "../controllers/admin/scheduleController.js";
import {
  getConversations,
  joinConversation,
  getMessages,
  sendMessage,
} from "../controllers/admin/chatController.js";
import {
  createReferralCode,
  getReferralCodes,
  updateReferralCode,
  deleteReferralCode,
} from "../controllers/admin/referralCodeController.js";
import {
  createJob,
  getJobs,
  updateJob,
  deleteJob,
} from "../controllers/admin/jobController.js";

const router = express.Router();

router.use(staffAuth);

router.get("/dashboard", getDashboard);

router.post("/tutors", createTutor);
router.get("/tutors", getTutors);

router.get("/students", getStudents);
router.get("/students/enrollments/by-course", getEnrollmentsByCourse);
router.get("/students/enrollments/export", exportAllEnrollments);
router.get("/students/:id", getStudentById);

router.post("/courses", uploadCourseImage.single("image"), createCourse);
router.get("/courses", getCourses);
router.get("/courses/:id/enrollments/export", exportCourseEnrollments);
router.get("/courses/:id/enrollments", getCourseEnrollments);
router.put("/courses/:id", uploadCourseImage.single("image"), updateCourse);
router.delete("/courses/:id", deleteCourse);

router.post("/workshops", createWorkshop);
router.get("/workshops", getWorkshops);
router.put("/workshops/:id", updateWorkshop);
router.delete("/workshops/:id", deleteWorkshop);

router.post("/companies", createPartnerCompany);
router.get("/companies", getCompanies);
router.put("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);

router.post("/batches", createBatch);
router.get("/batches", getBatches);
router.put("/batches/:id", updateBatch);
router.delete("/batches/:id", deleteBatch);

router.post("/schedules", createSchedule);
router.get("/schedules", getSchedules);
router.delete("/schedules/group/:groupId", deleteScheduleGroup);
router.put("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);

router.post("/jobs", createJob);
router.get("/jobs", getJobs);
router.put("/jobs/:id", updateJob);
router.delete("/jobs/:id", deleteJob);

router.post("/referral-codes", createReferralCode);
router.get("/referral-codes", getReferralCodes);
router.put("/referral-codes/:id", updateReferralCode);
router.delete("/referral-codes/:id", deleteReferralCode);

router.get("/conversations", getConversations);
router.post("/conversations/:id/join", joinConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", sendMessage);

export default router;
