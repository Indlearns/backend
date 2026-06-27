import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import path from "path";

const BUCKET = "tutorShowcaseImages";

const getBucket = () => {
  if (!mongoose.connection?.db) {
    throw new Error("Database not connected.");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
};

export const tutorShowcaseImagePublicPath = (fileId) =>
  `/api/media/tutor-showcase/${fileId}`;

export const parseTutorShowcaseImageId = (imageUrl) => {
  if (!imageUrl) return null;
  const match = String(imageUrl).match(/\/api\/media\/tutor-showcase\/([a-f0-9]{24})\/?$/i);
  return match ? match[1] : null;
};

export const saveTutorShowcaseImage = (file) => {
  const bucket = getBucket();
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `tutor-${Date.now()}${ext}`;

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

export const streamTutorShowcaseImage = async (fileId, res) => {
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

export const deleteTutorShowcaseImage = async (fileId) => {
  if (!ObjectId.isValid(fileId)) return;
  try {
    const bucket = getBucket();
    await bucket.delete(new ObjectId(fileId));
  } catch {
    /* file may already be gone */
  }
};

export const deleteTutorShowcaseImageByUrl = async (imageUrl) => {
  const gridId = parseTutorShowcaseImageId(imageUrl);
  if (gridId) await deleteTutorShowcaseImage(gridId);
};
