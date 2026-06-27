import express from "express";
import { getCourseImage, getTutorShowcaseImage } from "../controllers/mediaController.js";

const router = express.Router();

/** Public — course thumbnails (stored in MongoDB GridFS) */
router.get("/courses/:id", getCourseImage);
router.get("/tutor-showcase/:id", getTutorShowcaseImage);

export default router;
