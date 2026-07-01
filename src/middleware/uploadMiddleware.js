import multer from "multer";
import path from "path";

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error("Only image files (jpg, png, webp, gif) are allowed."));
};

/** Memory storage — files are saved to MongoDB GridFS in courseController */
export const uploadCourseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const videoFilter = (_req, file, cb) => {
  const allowed = /webm|mp4|ogg/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = /video\/(webm|mp4|ogg)/.test(file.mimetype);
  if (ext || mime) cb(null, true);
  else cb(new Error("Only video recordings (webm, mp4) are allowed."));
};

/** Class recording uploads — stored in MongoDB GridFS */
export const uploadClassRecording = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: videoFilter,
});
