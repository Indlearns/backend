import User from "../models/User.js";

export const syncBatchEnrollment = async (batch) => {
  if (!batch?.students?.length) return;

  const sourceType = batch.sourceType || "course";

  if (sourceType === "course" && batch.course) {
    await Promise.all(
      batch.students.map((sid) =>
        User.findByIdAndUpdate(sid, { $addToSet: { enrolledCourses: batch.course } })
      )
    );
    return;
  }

  if ((sourceType === "workshop" || sourceType === "hackathon") && batch.workshop) {
    await Promise.all(
      batch.students.map((sid) =>
        User.findByIdAndUpdate(sid, { $addToSet: { registeredWorkshops: batch.workshop } })
      )
    );
  }
};
