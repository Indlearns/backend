import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BUCKET = "courseImages";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.join(__dirname, "../../uploads/courses");

const getBucket = () => {
  if (!mongoose.connection?.db) {
    throw new Error("Database not connected.");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
};

export const courseImagePublicPath = (fileId) => `/api/media/courses/${fileId}`;

export const parseCourseImageId = (thumbnail) => {
  if (!thumbnail) return null;
  const match = String(thumbnail).match(/\/api\/media\/courses\/([a-f0-9]{24})\/?$/i);
  return match ? match[1] : null;
};

/** Save uploaded file buffer to MongoDB GridFS (persists on Render/cloud). */
export const saveCourseImage = (file) => {
  const bucket = getBucket();
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `course-${Date.now()}${ext}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname },
    });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id.toString()));
    uploadStream.end(file.buffer);
  });
};

export const streamCourseImage = async (fileId, res) => {
  if (!ObjectId.isValid(fileId)) {
    res.status(404).end();
    return;
  }

  const bucket = getBucket();
  const id = new ObjectId(fileId);
  const files = await bucket.find({ _id: id }).limit(1).toArray();

  if (!files.length) {
    res.status(404).end();
    return;
  }

  res.set("Content-Type", files[0].contentType || "image/jpeg");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  bucket.openDownloadStream(id).pipe(res);
};

export const deleteCourseImage = async (fileId) => {
  if (!ObjectId.isValid(fileId)) return;
  try {
    const bucket = getBucket();
    await bucket.delete(new ObjectId(fileId));
  } catch {
    /* file may already be gone */
  }
};

/** Remove stored image when course is updated or deleted. */
export const deleteCourseImageByThumbnail = async (thumbnail) => {
  const gridId = parseCourseImageId(thumbnail);
  if (gridId) {
    await deleteCourseImage(gridId);
    return;
  }

  if (thumbnail?.startsWith("/uploads/courses/")) {
    const filename = path.basename(thumbnail);
    const localPath = path.join(LOCAL_DIR, filename);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        /* ignore */
      }
    }
  }
};
