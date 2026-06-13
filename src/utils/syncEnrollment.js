import User from "../models/User.js";

export const syncBatchEnrollment = async (batch) => {
  if (!batch?.course || !batch?.students?.length) return;
  await Promise.all(
    batch.students.map((sid) =>
      User.findByIdAndUpdate(sid, { $addToSet: { enrolledCourses: batch.course } })
    )
  );
};
