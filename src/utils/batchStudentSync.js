import Batch from "../models/Batch.js";
import ClassSchedule from "../models/ClassSchedule.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { buildParticipantsFromBatch } from "./classAccess.js";
import { getBatchSourceTitle, getBatchSourceLabel } from "./batchSource.js";

const formatClassDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/** Add student to batch chat conversation participants */
const addStudentToBatchChat = async (batchId, studentId) => {
  const conv = await Conversation.findOne({ batch: batchId, type: "batch" });
  if (!conv) return;
  const uid = String(studentId);
  if (!conv.participants.map(String).includes(uid)) {
    conv.participants.push(studentId);
    await conv.save();
  }
};

/** Refresh participants on upcoming/live classes for a batch */
const syncBatchClassParticipants = async (batchDoc) => {
  const schedules = await ClassSchedule.find({
    batch: batchDoc._id,
    status: { $in: ["scheduled", "live"] },
  });

  await Promise.all(
    schedules.map(async (schedule) => {
      const next = buildParticipantsFromBatch(batchDoc, [
        schedule.createdBy,
        schedule.tutor,
      ]);
      const current = (schedule.participants || []).map(String).sort().join(",");
      const nextKey = next.map(String).sort().join(",");
      if (current !== nextKey) {
        schedule.participants = next;
        await schedule.save();
      }
    })
  );
};

const loadUpcomingClasses = async (batchId, limit = 12) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const classes = await ClassSchedule.find({
    batch: batchId,
    status: { $in: ["scheduled", "live"] },
    date: { $gte: today },
  })
    .populate("tutor", "name email")
    .sort({ date: 1, startTime: 1 })
    .limit(limit);

  return classes.map((c) => ({
    _id: c._id,
    title: c.title,
    date: c.date,
    dateLabel: formatClassDate(c.date),
    startTime: c.startTime,
    endTime: c.endTime,
    meetLink: c.meetLink || "",
    tutorName: c.tutor?.name || "",
    status: c.status,
  }));
};

const toBatchSummary = async (batch) => {
  const populated =
    batch.course || batch.workshop
      ? batch
      : await Batch.findById(batch._id)
          .populate("course", "title")
          .populate("workshop", "title eventType")
          .populate("tutor", "name email");

  const classes = await loadUpcomingClasses(batch._id);
  return {
    batchId: String(batch._id),
    batchName: batch.name,
    sourceType: batch.sourceType || (batch.workshop ? "workshop" : "course"),
    sourceLabel: getBatchSourceLabel(populated),
    sourceTitle: getBatchSourceTitle(populated),
    tutorName: populated.tutor?.name || batch.tutor?.name || "",
    tutorEmail: populated.tutor?.email || "",
    status: batch.status,
    classes,
  };
};

/**
 * Add a newly enrolled student to all matching non-completed batches
 * for the course or workshop/hackathon.
 */
export const addStudentToMatchingBatches = async (studentId, { courseId, workshopId } = {}) => {
  if (!studentId || (!courseId && !workshopId)) return [];

  const filter = { status: { $ne: "completed" } };
  if (courseId) filter.course = courseId;
  else filter.workshop = workshopId;

  const batches = await Batch.find(filter)
    .populate("course", "title")
    .populate("workshop", "title eventType")
    .populate("tutor", "name email");

  const summaries = [];

  for (const batch of batches) {
    const already = (batch.students || []).some((s) => String(s) === String(studentId));
    if (!already) {
      batch.students = [...(batch.students || []), studentId];
      await batch.save();
    }

    await addStudentToBatchChat(batch._id, studentId);
    await syncBatchClassParticipants(batch);
    summaries.push(await toBatchSummary(batch));
  }

  return summaries;
};

/**
 * When a batch is created/updated for a course or workshop, pull in
 * students who already enrolled in that item.
 */
export const syncEnrolledStudentsIntoBatch = async (batch) => {
  if (!batch?._id) return { added: 0 };

  const sourceType = batch.sourceType || (batch.workshop ? "workshop" : "course");
  let enrolledUsers = [];

  if (sourceType === "course" && batch.course) {
    enrolledUsers = await User.find({
      role: "student",
      enrolledCourses: batch.course,
    }).select("_id");
  } else if (batch.workshop) {
    enrolledUsers = await User.find({
      role: "student",
      registeredWorkshops: batch.workshop,
    }).select("_id");
  }

  if (!enrolledUsers.length) {
    await syncBatchClassParticipants(batch);
    return { added: 0, summaries: [] };
  }

  const existing = new Set((batch.students || []).map(String));
  const toAdd = enrolledUsers.filter((u) => !existing.has(String(u._id)));

  if (toAdd.length) {
    batch.students = [...(batch.students || []), ...toAdd.map((u) => u._id)];
    await batch.save();
  }

  for (const u of enrolledUsers) {
    await addStudentToBatchChat(batch._id, u._id);
  }
  await syncBatchClassParticipants(batch);

  return {
    added: toAdd.length,
    addedStudentIds: toAdd.map((u) => u._id),
    summary: await toBatchSummary(batch),
  };
};

export const getEnrollmentBatchDetails = async (studentId, { courseId, workshopId } = {}) => {
  const filter = { students: studentId, status: { $ne: "completed" } };
  if (courseId) filter.course = courseId;
  if (workshopId) filter.workshop = workshopId;

  const batches = await Batch.find(filter)
    .populate("course", "title")
    .populate("workshop", "title eventType")
    .populate("tutor", "name email");

  return Promise.all(batches.map((b) => toBatchSummary(b)));
};
