import Batch from "../models/Batch.js";
import Assignment from "../models/Assignment.js";
import ClassSchedule from "../models/ClassSchedule.js";

export const getTutorBatches = (tutorId) =>
  Batch.find({ tutor: tutorId })
    .populate("course", "title")
    .populate("workshop", "title eventType")
    .populate("students", "name email")
    .sort({ createdAt: -1 });

export const assertTutorBatch = async (tutorId, batchId) => {
  const batch = await Batch.findOne({ _id: batchId, tutor: tutorId });
  if (!batch) {
    const err = new Error("Batch not found or not assigned to you.");
    err.status = 404;
    throw err;
  }
  return batch;
};

export const assertTutorAssignment = async (tutorId, assignmentId) => {
  const assignment = await Assignment.findById(assignmentId).populate("batch");
  if (!assignment) {
    const err = new Error("Assignment not found.");
    err.status = 404;
    throw err;
  }
  if (String(assignment.batch?.tutor) !== String(tutorId)) {
    const err = new Error("Not allowed to access this assignment.");
    err.status = 403;
    throw err;
  }
  return assignment;
};

export const assertTutorSchedule = async (tutorId, scheduleId) => {
  const schedule = await ClassSchedule.findById(scheduleId).populate("batch");
  if (!schedule) {
    const err = new Error("Class not found.");
    err.status = 404;
    throw err;
  }
  if (
    String(schedule.tutor) !== String(tutorId) &&
    String(schedule.batch?.tutor) !== String(tutorId)
  ) {
    const err = new Error("You are not assigned to this class.");
    err.status = 403;
    throw err;
  }
  return schedule;
};
