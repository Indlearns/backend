import Batch from "../models/Batch.js";
import ClassRecording from "../models/ClassRecording.js";
import { isStaffAdmin } from "./classAccess.js";

export const canAccessBatchRecordings = async (user, batchId) => {
  if (!user || !batchId) return false;
  if (isStaffAdmin(user.role)) return true;

  const batch = await Batch.findById(batchId).select("tutor students");
  if (!batch) return false;

  if (user.role === "tutor") {
    return String(batch.tutor) === String(user._id);
  }

  if (user.role === "student") {
    return (batch.students || []).some((s) => String(s) === String(user._id));
  }

  return false;
};

export const canAccessRecording = async (user, recording) => {
  if (!user || !recording) return false;
  return canAccessBatchRecordings(user, recording.batch?._id || recording.batch);
};

export const canUploadClassRecording = async (user, schedule, batch) => {
  if (!user || !schedule) return false;
  if (isStaffAdmin(user.role)) return true;
  if (user.role !== "tutor") return false;
  const batchDoc = batch || (await Batch.findById(schedule.batch));
  return (
    String(schedule.tutor) === String(user._id) ||
    String(batchDoc?.tutor) === String(user._id)
  );
};

export const canDeleteRecording = (user) => isStaffAdmin(user?.role);
