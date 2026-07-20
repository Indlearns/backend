import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import { normalizeEventType } from "./workshopVisibility.js";

export const BATCH_SOURCE_TYPES = ["course", "workshop", "hackathon"];

export const normalizeBatchSourceType = (value) => {
  const type = String(value || "course").toLowerCase().trim();
  return BATCH_SOURCE_TYPES.includes(type) ? type : "course";
};

/** Resolve and validate the linked course or workshop/hackathon for a batch. */
export const resolveBatchSource = async ({ sourceType, course, workshop }) => {
  const type = normalizeBatchSourceType(sourceType);

  if (type === "course") {
    if (!course) {
      throw Object.assign(new Error("Course is required for a course batch."), { status: 400 });
    }
    const courseDoc = await Course.findById(course).select("_id title");
    if (!courseDoc) {
      throw Object.assign(new Error("Selected course was not found."), { status: 400 });
    }
    return { sourceType: "course", course: courseDoc._id, workshop: null };
  }

  if (!workshop) {
    throw Object.assign(new Error("Workshop or hackathon is required."), { status: 400 });
  }

  const workshopDoc = await Workshop.findById(workshop).select("_id title eventType");
  if (!workshopDoc) {
    throw Object.assign(new Error("Selected workshop/hackathon was not found."), { status: 400 });
  }

  const eventType = normalizeEventType(workshopDoc.eventType);
  if (type === "workshop" && eventType !== "workshop") {
    throw Object.assign(new Error("Selected item is not a workshop."), { status: 400 });
  }
  if (type === "hackathon" && eventType !== "hackathon") {
    throw Object.assign(new Error("Selected item is not a hackathon."), { status: 400 });
  }

  return {
    sourceType: type,
    course: null,
    workshop: workshopDoc._id,
  };
};

export const populateBatchSource = (query) =>
  query
    .populate("course", "title description category level duration thumbnail price")
    .populate("workshop", "title description eventType date startTime endTime price status");

/** Human-readable title for the batch's linked item */
export const getBatchSourceTitle = (batch) => {
  if (!batch) return "";
  if (batch.course?.title) return batch.course.title;
  if (batch.workshop?.title) return batch.workshop.title;
  return "";
};

export const getBatchSourceLabel = (batch) => {
  const type = batch?.sourceType || (batch?.workshop ? "workshop" : "course");
  if (type === "hackathon") return "Hackathon";
  if (type === "workshop") return "Workshop";
  return "Course";
};
