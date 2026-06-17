import express from "express";
import { getCourseImage } from "../controllers/mediaController.js";

const router = express.Router();

/** Public — course thumbnails (stored in MongoDB GridFS) */
router.get("/courses/:id", getCourseImage);

export default router;
