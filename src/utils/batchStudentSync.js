import Batch from "../models/Batch.js";
import ClassSchedule from "../models/ClassSchedule.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import CoursePurchase from "../models/CoursePurchase.js";
import { buildParticipantsFromBatch } from "./classAccess.js";

/** Sync batch chat + class participants after manual student changes */
export const applyBatchStudentList = async (batch) => {
  if (!batch?._id) return;

  const fullBatch = await Batch.findById(batch._id);
  if (!fullBatch) return;

  const conv = await Conversation.findOne({ batch: fullBatch._id, type: "batch" });
  if (conv) {
    const ids = [
      ...conv.participants,
      ...(fullBatch.tutor ? [fullBatch.tutor] : []),
      ...(fullBatch.students || []),
      fullBatch.createdBy,
    ].filter(Boolean);
    conv.participants = [...new Map(ids.map((id) => [String(id), id])).values()];
    await conv.save();
  }

  const schedules = await ClassSchedule.find({
    batch: fullBatch._id,
    status: { $in: ["scheduled", "live"] },
  });

  await Promise.all(
    schedules.map(async (schedule) => {
      schedule.participants = buildParticipantsFromBatch(fullBatch, [
        schedule.createdBy,
        schedule.tutor,
      ]);
      await schedule.save();
    })
  );
};

/** Students eligible to be added manually (enrolled in linked course / workshop) */
export const getEligibleStudentsForBatch = async (batch) => {
  const sourceType = batch.sourceType || (batch.workshop ? "workshop" : "course");
  let studentIds = new Set();

  if (sourceType === "course" && batch.course) {
    const purchases = await CoursePurchase.find({
      course: batch.course,
      status: "paid",
    }).select("student");
    purchases.forEach((p) => studentIds.add(String(p.student)));

    const enrolled = await User.find({
      role: "student",
      enrolledCourses: batch.course,
    }).select("_id");
    enrolled.forEach((u) => studentIds.add(String(u._id)));
  } else if (batch.workshop) {
    const enrolled = await User.find({
      role: "student",
      registeredWorkshops: batch.workshop,
    }).select("_id");
    enrolled.forEach((u) => studentIds.add(String(u._id)));
  }

  if (!studentIds.size) return [];

  return User.find({
    _id: { $in: [...studentIds] },
    role: "student",
    isActive: { $ne: false },
  })
    .select("name email phone")
    .sort({ name: 1 });
};
