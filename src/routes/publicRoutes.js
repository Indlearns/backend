import express from "express";
import {
  getHome,
  getCourses,
  getCourseById,
  getWorkshops,
  getWorkshopById,
  getCompanies,
  getPublicJobs,
} from "../controllers/publicController.js";

const router = express.Router();

router.get("/home", getHome);
router.get("/courses", getCourses);
router.get("/courses/:id", getCourseById);
router.get("/workshops", getWorkshops);
router.get("/workshops/:id", getWorkshopById);
router.get("/companies", getCompanies);
router.get("/jobs", getPublicJobs);

export default router;
