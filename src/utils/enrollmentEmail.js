import User from "../models/User.js";
import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import Batch from "../models/Batch.js";
import {
  isEmailConfigured,
  sendEmail,
  sendEnrollmentSuccessEmail,
  sendTutorClassAssignmentEmail,
  sendTutorBatchAssignmentEmail,
} from "./sendEmail.js";
import { addStudentToMatchingBatches } from "./batchStudentSync.js";
import { getBatchSourceLabel, getBatchSourceTitle } from "./batchSource.js";
import { getClientUrl } from "../config/clientUrl.js";

const resolveItemDetails = async (purchaseType, itemId) => {
  if (purchaseType === "course") {
    const course = await Course.findById(itemId).select("title");
    return {
      itemType: "course",
      itemTitle: course?.title || "Course",
      courseId: itemId,
      workshopId: null,
    };
  }

  const workshop = await Workshop.findById(itemId).select("title eventType");
  const itemType = workshop?.eventType === "hackathon" ? "hackathon" : "workshop";
  return {
    itemType,
    itemTitle: workshop?.title || (itemType === "hackathon" ? "Hackathon" : "Workshop"),
    courseId: null,
    workshopId: itemId,
  };
};

const formatDateLabel = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * After enrollment: add student to matching batches/classes, then email
 * with batch + upcoming class details.
 */
export const notifyEnrollmentSuccess = async ({
  studentId,
  purchaseType,
  itemId,
  amountPaid = 0,
}) => {
  try {
    const { itemType, itemTitle, courseId, workshopId } = await resolveItemDetails(
      purchaseType,
      itemId
    );

    const batches = await addStudentToMatchingBatches(studentId, {
      courseId,
      workshopId,
    });

    if (!isEmailConfigured()) {
      console.log(
        `[enrollment email] SMTP not configured — skipped for student ${studentId}`
      );
      return { batches };
    }

    const student = await User.findById(studentId).select("name email");
    if (!student?.email?.trim()) return { batches };

    await sendEnrollmentSuccessEmail({
      to: student.email,
      name: student.name,
      itemType,
      itemTitle,
      amountPaid,
      batches,
    });

    return { batches };
  } catch (error) {
    console.error("[enrollment email]", error.message);
    return { batches: [] };
  }
};

/** Email tutor when assigned to one or more class schedules */
export const notifyTutorClassAssignment = async (schedules) => {
  if (!isEmailConfigured()) return;
  const list = (Array.isArray(schedules) ? schedules : [schedules]).filter(Boolean);
  if (!list.length) return;

  // Group by tutor so a month-long series sends one email, not dozens
  const byTutor = new Map();
  for (const schedule of list) {
    const tutorId = String(schedule.tutor?._id || schedule.tutor || "");
    if (!tutorId) continue;
    if (!byTutor.has(tutorId)) byTutor.set(tutorId, []);
    byTutor.get(tutorId).push(schedule);
  }

  for (const [, tutorSchedules] of byTutor) {
    try {
      const first = tutorSchedules[0];
      const tutor =
        first.tutor?.email
          ? first.tutor
          : await User.findById(first.tutor).select("name email");
      if (!tutor?.email?.trim()) continue;

      let batch = first.batch;
      if (!batch?.name || (!batch.course && !batch.workshop)) {
        batch = await Batch.findById(first.batch?._id || first.batch)
          .populate("course", "title")
          .populate("workshop", "title eventType")
          .populate("students", "_id");
      }

      if (tutorSchedules.length === 1) {
        await sendTutorClassAssignmentEmail({
          to: tutor.email,
          name: tutor.name,
          classTitle: first.title,
          batchName: batch?.name || "Batch",
          sourceTitle: getBatchSourceTitle(batch),
          dateLabel: formatDateLabel(first.date),
          startTime: first.startTime,
          endTime: first.endTime,
          studentCount: batch?.students?.length || 0,
          meetLink: first.meetLink || "",
          notes: first.notes || "",
        });
        continue;
      }

      const dateLines = tutorSchedules
        .slice(0, 40)
        .map((s) => `  • ${formatDateLabel(s.date)} · ${s.startTime}–${s.endTime}`)
        .join("\n");
      const more =
        tutorSchedules.length > 40
          ? `\n  …and ${tutorSchedules.length - 40} more`
          : "";

      const clientUrl = getClientUrl();
      const portalUrl = `${clientUrl}/tutor/classes`;
      const greeting = tutor.name ? `Hi ${tutor.name},` : "Hi,";
      const sourceTitle = getBatchSourceTitle(batch);
      const subject = `${tutorSchedules.length} classes assigned: ${first.title} — IndLearn`;
      const text = [
        greeting,
        "",
        `You have been assigned to ${tutorSchedules.length} live classes on IndLearn.`,
        "",
        `Class: ${first.title}`,
        `Batch: ${batch?.name || "Batch"}`,
        sourceTitle ? `Program: ${sourceTitle}` : null,
        `Time: ${first.startTime}–${first.endTime}`,
        `Students in batch: ${batch?.students?.length || 0}`,
        "",
        "Dates:",
        dateLines + more,
        "",
        `Open tutor portal: ${portalUrl}`,
        "",
        "— IndLearn Team",
      ]
        .filter(Boolean)
        .join("\n");

      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <h2 style="color:#0f766e;margin:0 0 8px">New class series assigned</h2>
          <p style="color:#334155;line-height:1.6">${greeting}</p>
          <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc">
            <p style="margin:0 0 8px;font-weight:700;font-size:18px">${first.title}</p>
            <p style="margin:4px 0"><strong>Batch:</strong> ${batch?.name || "Batch"}</p>
            ${sourceTitle ? `<p style="margin:4px 0"><strong>Program:</strong> ${sourceTitle}</p>` : ""}
            <p style="margin:4px 0"><strong>Time:</strong> ${first.startTime}–${first.endTime}</p>
            <p style="margin:4px 0"><strong>Sessions:</strong> ${tutorSchedules.length}</p>
            <p style="margin:12px 0 4px;font-weight:600;color:#0f766e">Dates</p>
            <ul style="margin:0;padding-left:18px;line-height:1.6">
              ${tutorSchedules
                .slice(0, 40)
                .map(
                  (s) =>
                    `<li>${formatDateLabel(s.date)} · ${s.startTime}–${s.endTime}</li>`
                )
                .join("")}
            </ul>
          </div>
          <p style="margin:28px 0">
            <a href="${portalUrl}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
              Open tutor classes
            </a>
          </p>
        </div>
      `;

      await sendEmail({ to: tutor.email, subject, text, html });
    } catch (error) {
      console.error("[tutor class email]", error.message);
    }
  }
};

/** Email students who were auto-added to a newly created/updated batch */
export const notifyStudentsAddedToBatch = async (studentIds, batchSummary) => {
  if (!isEmailConfigured() || !studentIds?.length || !batchSummary) return;

  for (const studentId of studentIds) {
    try {
      const student = await User.findById(studentId).select("name email");
      if (!student?.email?.trim()) continue;

      const itemType =
        batchSummary.sourceType === "hackathon"
          ? "hackathon"
          : batchSummary.sourceType === "workshop"
            ? "workshop"
            : "course";

      await sendEnrollmentSuccessEmail({
        to: student.email,
        name: student.name,
        itemType,
        itemTitle: batchSummary.sourceTitle || batchSummary.batchName,
        amountPaid: 0,
        batches: [batchSummary],
      });
    } catch (error) {
      console.error("[batch add email]", error.message);
    }
  }
};

/** Email tutor when assigned to a batch (create/update) */
export const notifyTutorBatchAssignment = async (batch, tutorId) => {
  if (!isEmailConfigured() || !tutorId) return;

  try {
    const tutor = await User.findById(tutorId).select("name email");
    if (!tutor?.email?.trim()) return;

    let populated = batch;
    if (!batch.course && !batch.workshop) {
      populated = await Batch.findById(batch._id)
        .populate("course", "title")
        .populate("workshop", "title eventType");
    }

    await sendTutorBatchAssignmentEmail({
      to: tutor.email,
      name: tutor.name,
      batchName: populated.name,
      sourceLabel: getBatchSourceLabel(populated),
      sourceTitle: getBatchSourceTitle(populated),
      studentCount: populated.students?.length || 0,
      startDate: populated.startDate ? formatDateLabel(populated.startDate) : "",
      endDate: populated.endDate ? formatDateLabel(populated.endDate) : "",
    });
  } catch (error) {
    console.error("[tutor batch email]", error.message);
  }
};
