import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import path from "path";

const BUCKET = "classRecordings";

const getBucket = () => {
  if (!mongoose.connection?.db) {
    throw new Error("Database not connected.");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
};

export const classRecordingPublicPath = (fileId) => `/api/media/class-recordings/${fileId}`;

export const parseClassRecordingFileId = (filePath) => {
  if (!filePath) return null;
  const match = String(filePath).match(/\/api\/media\/class-recordings\/([a-f0-9]{24})\/?$/i);
  return match ? match[1] : null;
};

export const saveClassRecording = (file, metadata = {}) => {
  const bucket = getBucket();
  const ext = path.extname(file.originalname).toLowerCase() || ".webm";
  const filename = `class-recording-${Date.now()}${ext}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype || "video/webm",
      metadata,
    });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id.toString()));
    uploadStream.end(file.buffer);
  });
};

export const streamClassRecording = async (fileId, res) => {
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

  res.set("Content-Type", files[0].contentType || "video/webm");
  res.set("Accept-Ranges", "bytes");
  res.set("Cache-Control", "private, max-age=3600");
  bucket.openDownloadStream(id).pipe(res);
};

export const deleteClassRecordingFile = async (filePath) => {
  const fileId = parseClassRecordingFileId(filePath);
  if (!fileId || !ObjectId.isValid(fileId)) return;
  try {
    const bucket = getBucket();
    await bucket.delete(new ObjectId(fileId));
  } catch {
    /* ignore */
  }
};
