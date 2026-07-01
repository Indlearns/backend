import ClassSchedule from "../models/ClassSchedule.js";
import ClassRecording from "../models/ClassRecording.js";
import Batch from "../models/Batch.js";
import {
  saveClassRecording,
  classRecordingPublicPath,
  deleteClassRecordingFile,
  streamClassRecording,
} from "../utils/classRecordingStorage.js";
import {
  canAccessBatchRecordings,
  canAccessRecording,
  canUploadClassRecording,
  canDeleteRecording,
} from "../utils/classRecordingAccess.js";
import { canJoinClass } from "../utils/classAccess.js";

export const uploadClassRecording = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findById(req.params.scheduleId).populate("batch");
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Class not found." });
    }

    const batch = schedule.batch?._id ? schedule.batch : await Batch.findById(schedule.batch);
    if (!(await canUploadClassRecording(req.user, schedule, batch))) {
      return res.status(403).json({
        success: false,
        message: "Only the batch tutor or admin can save class recordings.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Recording file is required." });
    }

    const durationSeconds = Number(req.body.durationSeconds) || 0;
    const fileId = await saveClassRecording(req.file, {
      scheduleId: String(schedule._id),
      batchId: String(batch._id),
      recordedBy: String(req.user._id),
    });

    const recording = await ClassRecording.create({
      schedule: schedule._id,
      batch: batch._id,
      title: schedule.title,
      classDate: schedule.date,
      durationSeconds,
      filePath: classRecordingPublicPath(fileId),
      fileSize: req.file.size,
      mimeType: req.file.mimetype || "video/webm",
      recordedBy: req.user._id,
    });

    if (schedule.status === "live") {
      schedule.status = "completed";
      await schedule.save();
    }

    res.status(201).json({ success: true, data: recording });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const listClassRecordings = async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};

    if (batchId) {
      const allowed = await canAccessBatchRecordings(req.user, batchId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }
      filter.batch = batchId;
    } else if (canDeleteRecording(req.user)) {
      // admin/superadmin — all batches
    } else if (req.user.role === "tutor") {
      const batches = await Batch.find({ tutor: req.user._id }).select("_id");
      filter.batch = { $in: batches.map((b) => b._id) };
    } else if (req.user.role === "student") {
      const batches = await Batch.find({ students: req.user._id }).select("_id");
      filter.batch = { $in: batches.map((b) => b._id) };
    } else {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const recordings = await ClassRecording.find(filter)
      .populate("batch", "name")
      .populate("schedule", "title date startTime endTime")
      .populate("recordedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: recordings.length, data: recordings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClassRecordingStream = async (req, res) => {
  try {
    const recording = await ClassRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: "Recording not found." });
    }

    if (!(await canAccessRecording(req.user, recording))) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const fileId = recording.filePath.split("/").pop();
    await streamClassRecording(fileId, res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const deleteClassRecording = async (req, res) => {
  try {
    if (!canDeleteRecording(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or super admin can delete recordings.",
      });
    }

    const recording = await ClassRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: "Recording not found." });
    }

    await deleteClassRecordingFile(recording.filePath);
    await recording.deleteOne();
    res.json({ success: true, message: "Recording deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecordingsForSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findById(req.params.scheduleId).populate("batch");
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Class not found." });
    }

    const batch = schedule.batch?._id ? schedule.batch : await Batch.findById(schedule.batch);
    if (!canJoinClass(req.user, schedule, batch)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const recordings = await ClassRecording.find({ schedule: schedule._id })
      .populate("recordedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: recordings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
