import Batch from "../../models/Batch.js";
import ClassSchedule from "../../models/ClassSchedule.js";
import Assignment from "../../models/Assignment.js";
import Submission from "../../models/Submission.js";
import MeetingRequest from "../../models/MeetingRequest.js";
import Conversation from "../../models/Conversation.js";
import User from "../../models/User.js";
import {
  getTutorBatches,
  assertTutorBatch,
  assertTutorAssignment,
  assertTutorSchedule,
} from "../../utils/tutorAccess.js";
import { createVideoRoomId, ensureVideoRoomId } from "../../utils/videoRoom.js";
import { joinLiveClassForUser } from "../../utils/classScheduleJoin.js";
import { syncScheduleParticipants } from "../../utils/classAccess.js";
import { ROLES } from "../../config/roleConfig.js";

export const getDashboard = async (req, res) => {
  try {
    const batches = await Batch.find({ tutor: req.user._id });
    const batchIds = batches.map((b) => b._id);
    const [classes, assignments, pendingMeetings, submissions] = await Promise.all([
      ClassSchedule.countDocuments({ batch: { $in: batchIds }, status: "scheduled" }),
      Assignment.countDocuments({ batch: { $in: batchIds } }),
      MeetingRequest.countDocuments({ tutor: req.user._id, status: "pending" }),
      Submission.countDocuments({
        assignment: {
          $in: await Assignment.find({ batch: { $in: batchIds } }).distinct("_id"),
        },
        status: "submitted",
      }),
    ]);

    res.json({
      success: true,
      data: {
        batches: batches.length,
        upcomingClasses: classes,
        assignments,
        pendingMeetings,
        submissionsToGrade: submissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyBatches = async (req, res) => {
  try {
    const batches = await getTutorBatches(req.user._id);
    res.json({ success: true, count: batches.length, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyClasses = async (req, res) => {
  try {
    const batches = await Batch.find({ tutor: req.user._id }).select("_id");
    const batchIds = batches.map((b) => b._id);

    const filter = {
      $or: [{ tutor: req.user._id }, { participants: req.user._id }, { batch: { $in: batchIds } }],
    };
    if (req.query.upcoming === "true") {
      filter.date = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
      filter.status = { $in: ["scheduled", "live"] };
    }

    const schedules = await ClassSchedule.find(filter)
      .populate("batch", "name")
      .populate({ path: "batch", populate: { path: "course", select: "title" } })
      .sort({ date: 1, startTime: 1 });

    for (const s of schedules) {
      await syncScheduleParticipants(s, s.batch);
      await ensureVideoRoomId(s, "class", "_id");
    }

    res.json({ success: true, count: schedules.length, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const joinClass = async (req, res) => {
  try {
    const data = await joinLiveClassForUser(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const updateClassStatus = async (req, res) => {
  try {
    const schedule = await assertTutorSchedule(req.user._id, req.params.id);
    const { status } = req.body;
    if (!["scheduled", "live", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    schedule.status = status;
    await schedule.save();
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getAssignments = async (req, res) => {
  try {
    const batches = await Batch.find({ tutor: req.user._id }).select("_id");
    const filter = { batch: { $in: batches.map((b) => b._id) } };
    if (req.query.batch) filter.batch = req.query.batch;

    const assignments = await Assignment.find(filter)
      .populate("batch", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAssignment = async (req, res) => {
  try {
    const { batch, title, description, instructions, dueDate, maxScore, attachments, isPublished } =
      req.body;
    await assertTutorBatch(req.user._id, batch);
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const assignment = await Assignment.create({
      batch,
      title,
      description,
      instructions,
      dueDate,
      maxScore: maxScore ?? 100,
      attachments: attachments || [],
      isPublished: isPublished !== false,
      createdBy: req.user._id,
    });

    const populated = await Assignment.findById(assignment._id).populate("batch", "name");
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const assignment = await assertTutorAssignment(req.user._id, req.params.id);
    const allowed = [
      "title",
      "description",
      "instructions",
      "dueDate",
      "maxScore",
      "attachments",
      "isPublished",
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) assignment[k] = req.body[k];
    });
    await assignment.save();
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    await assertTutorAssignment(req.user._id, req.params.id);
    await Submission.deleteMany({ assignment: req.params.id });
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Assignment deleted." });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const getSubmissions = async (req, res) => {
  try {
    await assertTutorAssignment(req.user._id, req.params.id);
    const submissions = await Submission.find({ assignment: req.params.id })
      .populate("student", "name email")
      .sort({ submittedAt: -1 });
    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const { score, feedback, status } = req.body;
    const submission = await Submission.findById(req.params.submissionId).populate({
      path: "assignment",
      populate: { path: "batch" },
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found." });
    }
    if (String(submission.assignment.batch.tutor) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not allowed." });
    }

    const max = submission.assignment.maxScore || 100;
    if (score !== undefined && (score < 0 || score > max)) {
      return res.status(400).json({
        success: false,
        message: `Score must be between 0 and ${max}.`,
      });
    }

    if (score !== undefined) submission.score = score;
    if (feedback !== undefined) submission.feedback = feedback;
    submission.status = status || "graded";
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    await submission.save();

    const populated = await Submission.findById(submission._id).populate(
      "student",
      "name email"
    );
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMeetingRequests = async (req, res) => {
  try {
    const filter = { tutor: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const requests = await MeetingRequest.find(filter)
      .populate("student", "name email")
      .populate("batch", "name")
      .populate("conversation")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const respondMeetingRequest = async (req, res) => {
  try {
    const { action, responseNote } = req.body;
    const request = await MeetingRequest.findById(req.params.id).populate("student");
    if (!request || String(request.tutor) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request already handled." });
    }

    if (action === "decline") {
      request.status = "declined";
      request.responseNote = responseNote || "";
      request.respondedAt = new Date();
      await request.save();
      return res.json({ success: true, data: request });
    }

    if (action !== "accept") {
      return res.status(400).json({ success: false, message: "Use action accept or decline." });
    }

    const student = request.student;
    const pair = [req.user._id, student._id];
    let conv = await Conversation.findOne({
      type: { $in: ["doubt", "student_peer"] },
      participants: { $all: pair },
    });
    conv = conv?.participants?.length === 2 ? conv : null;

    if (!conv) {
      const key = [String(req.user._id), String(student._id)].sort().join("_");
      conv = await Conversation.create({
        title: `${request.type === "meeting" ? "Meeting" : "Doubt"} — ${student.name}`,
        type: "doubt",
        batch: request.batch,
        participants: pair,
        videoRoomId: createVideoRoomId("doubt", key),
        createdBy: req.user._id,
      });
    }

    request.status = "accepted";
    request.conversation = conv._id;
    request.responseNote = responseNote || "";
    request.respondedAt = new Date();
    await request.save();

    const populated = await MeetingRequest.findById(request._id)
      .populate("student", "name email")
      .populate("conversation");

    res.json({
      success: true,
      data: populated,
      conversationId: conv._id,
      videoRoom: conv.videoRoomId || conv.jitsiRoomName,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** Admin assigns a meeting to tutor */
export const assignMeetingByStaff = async (req, res) => {
  try {
    const { tutorId, studentId, batchId, type, title, message, preferredAt } = req.body;
    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== ROLES.TUTOR) {
      return res.status(400).json({ success: false, message: "Invalid tutor." });
    }

    const request = await MeetingRequest.create({
      type: type || "meeting",
      title: title || "Scheduled meeting",
      message: message || "",
      batch: batchId,
      student: studentId,
      tutor: tutorId,
      preferredAt,
      status: "pending",
      createdBy: req.user._id,
    });

    const populated = await MeetingRequest.findById(request._id)
      .populate("student", "name email")
      .populate("tutor", "name email")
      .populate("batch", "name");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
