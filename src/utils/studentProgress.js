import Batch from "../models/Batch.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import ClassSchedule from "../models/ClassSchedule.js";

export const computeBatchProgress = async (studentId, batchId) => {
  const batch = await Batch.findById(batchId)
    .populate("course", "title category level")
    .populate("workshop", "title eventType date");
  if (!batch) return null;

  const assignmentIds = await Assignment.find({
    batch: batchId,
    isPublished: true,
  }).distinct("_id");

  const totalAssignments = assignmentIds.length;
  const submissions = await Submission.find({
    student: studentId,
    assignment: { $in: assignmentIds },
  });
  const submitted = submissions.filter((s) => s.status !== "draft").length;
  const graded = submissions.filter((s) => s.status === "graded").length;
  const avgScore =
    graded > 0
      ? Math.round(
          submissions
            .filter((s) => s.status === "graded" && s.score != null)
            .reduce((sum, s) => sum + s.score, 0) / graded
        )
      : null;

  const totalClasses = await ClassSchedule.countDocuments({ batch: batchId });
  const completedClasses = await ClassSchedule.countDocuments({
    batch: batchId,
    status: "completed",
  });

  const assignmentPct = totalAssignments
    ? Math.round((submitted / totalAssignments) * 100)
    : 0;
  const classPct = totalClasses ? Math.round((completedClasses / totalClasses) * 100) : 0;
  const overallPercent = Math.round(assignmentPct * 0.6 + classPct * 0.4);

  const milestones = [];
  if (submitted > 0) milestones.push(`Submitted ${submitted} assignment(s)`);
  if (graded > 0) milestones.push(`Graded on ${graded} assignment(s)`);
  if (completedClasses > 0) milestones.push(`Attended ${completedClasses} completed class(es)`);
  if (overallPercent >= 50) milestones.push("Halfway through the program");
  if (overallPercent >= 100) milestones.push("Program completed");

  return {
    batchId: batch._id,
    batchName: batch.name,
    sourceType: batch.sourceType || (batch.workshop ? "workshop" : "course"),
    course: batch.course,
    workshop: batch.workshop,
    overallPercent,
    assignmentPct,
    classPct,
    stats: {
      totalAssignments,
      submittedAssignments: submitted,
      gradedAssignments: graded,
      averageScore: avgScore,
      totalClasses,
      completedClasses,
    },
    milestones,
  };
};

export const getStudentEnrollments = async (studentId) => {
  const batches = await Batch.find({ students: studentId })
    .populate("course", "title description category level duration thumbnail")
    .populate("workshop", "title description eventType date startTime endTime")
    .populate("tutor", "name email")
    .sort({ updatedAt: -1 });

  const withProgress = await Promise.all(
    batches.map(async (b) => ({
      batch: b,
      progress: await computeBatchProgress(studentId, b._id),
    }))
  );

  return withProgress;
};
