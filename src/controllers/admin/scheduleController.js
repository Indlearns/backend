import ClassSchedule from "../../models/ClassSchedule.js";
import Batch from "../../models/Batch.js";
import crypto from "crypto";
import { createVideoRoomId } from "../../utils/videoRoom.js";
import { buildParticipantsFromBatch } from "../../utils/classAccess.js";
import { resolveScheduleDates } from "../../utils/scheduleDates.js";

const buildScheduleDoc = (batchDoc, userId, fields, dateStr, scheduleGroupId) => {
  const tutorId = fields.tutor || batchDoc.tutor;
  const participants = buildParticipantsFromBatch(batchDoc, [userId, tutorId]);

  return {
    batch: batchDoc._id,
    title: fields.title,
    date: dateStr,
    startTime: fields.startTime,
    endTime: fields.endTime,
    meetLink: fields.meetLink || "",
    tutor: tutorId,
    notes: fields.notes || "",
    participants,
    scheduleGroupId: scheduleGroupId || "",
    videoRoomId: createVideoRoomId("class", `${batchDoc._id}_${dateStr}_${fields.startTime}`),
    createdBy: userId,
  };
};

export const createSchedule = async (req, res) => {
  try {
    const { batch, title, startTime, endTime, meetLink, tutor, notes } = req.body;

    if (!batch || !title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Batch, title, start time, and end time are required.",
      });
    }

    const dateList = resolveScheduleDates(req.body);
    if (!dateList.length) {
      return res.status(400).json({
        success: false,
        message: "Provide a date, dates array, or fromDate + toDate with weekdays.",
      });
    }

    if (dateList.length > 366) {
      return res.status(400).json({
        success: false,
        message: "Too many dates (max 366 per request).",
      });
    }

    const batchDoc = await Batch.findById(batch);
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: "Batch not found." });
    }

    const scheduleGroupId = dateList.length > 1 ? crypto.randomUUID() : "";
    const fields = { title, startTime, endTime, meetLink, tutor, notes };

    const docs = dateList.map((dateStr) =>
      buildScheduleDoc(batchDoc, req.user._id, fields, dateStr, scheduleGroupId)
    );

    if (docs.length === 1) {
      const schedule = await ClassSchedule.create(docs[0]);
      const populated = await ClassSchedule.findById(schedule._id)
        .populate("batch", "name")
        .populate("tutor", "name email")
        .populate("participants", "name email role");

      return res.status(201).json({
        success: true,
        count: 1,
        message: "1 class scheduled.",
        data: populated,
      });
    }

    const created = await ClassSchedule.insertMany(docs);
    const populated = await ClassSchedule.find({ _id: { $in: created.map((c) => c._id) } })
      .populate("batch", "name")
      .populate("tutor", "name email")
      .populate("participants", "name email role")
      .sort({ date: 1 });

    res.status(201).json({
      success: true,
      count: populated.length,
      scheduleGroupId,
      message: `${populated.length} classes scheduled at ${startTime}–${endTime}.`,
      data: populated,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getSchedules = async (req, res) => {
  const filter = {};
  if (req.query.batch) filter.batch = req.query.batch;

  const schedules = await ClassSchedule.find(filter)
    .populate("batch", "name course")
    .populate({ path: "batch", populate: { path: "course", select: "title" } })
    .populate("tutor", "name email")
    .populate("participants", "name email role")
    .sort({ date: 1, startTime: 1 });

  res.json({ success: true, count: schedules.length, data: schedules });
};

export const updateSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "Class not found." });

    const batchId = req.body.batch || schedule.batch;
    const batchDoc = await Batch.findById(batchId);
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: "Batch not found." });
    }

    Object.assign(schedule, req.body);
    schedule.participants = buildParticipantsFromBatch(batchDoc, [
      schedule.createdBy,
      schedule.tutor,
    ]);
    await schedule.save();

    const populated = await ClassSchedule.findById(schedule._id)
      .populate("batch", "name")
      .populate("tutor", "name email")
      .populate("participants", "name email role");

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteSchedule = async (req, res) => {
  const schedule = await ClassSchedule.findByIdAndDelete(req.params.id);
  if (!schedule) return res.status(404).json({ success: false, message: "Class not found." });
  res.json({ success: true, message: "Class deleted." });
};

/** Delete all classes in the same bulk schedule group */
export const deleteScheduleGroup = async (req, res) => {
  const { groupId } = req.params;
  if (!groupId) {
    return res.status(400).json({ success: false, message: "Group id required." });
  }
  const result = await ClassSchedule.deleteMany({ scheduleGroupId: groupId });
  res.json({
    success: true,
    message: `${result.deletedCount} class(es) deleted.`,
    deletedCount: result.deletedCount,
  });
};
