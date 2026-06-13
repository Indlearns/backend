import Batch from "../../models/Batch.js";
import Assignment from "../../models/Assignment.js";
import Submission from "../../models/Submission.js";
import MeetingRequest from "../../models/MeetingRequest.js";
import User from "../../models/User.js";
import { ROLES } from "../../config/roleConfig.js";

export const getMyAssignments = async (req, res) => {
  try {
    const batches = await Batch.find({ students: req.user._id }).select("_id");
    const assignments = await Assignment.find({
      batch: { $in: batches.map((b) => b._id) },
      isPublished: true,
    })
      .populate("batch", "name")
      .sort({ dueDate: 1, createdAt: -1 });

    const subs = await Submission.find({
      student: req.user._id,
      assignment: { $in: assignments.map((a) => a._id) },
    });
    const subMap = Object.fromEntries(subs.map((s) => [String(s.assignment), s]));

    const data = assignments.map((a) => ({
      ...a.toObject(),
      mySubmission: subMap[String(a._id)] || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitAssignment = async (req, res) => {
  try {
    const { content, attachmentUrl } = req.body;
    const assignment = await Assignment.findById(req.params.id).populate("batch");
    if (!assignment || !assignment.isPublished) {
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    const inBatch = assignment.batch.students.some(
      (id) => String(id) === String(req.user._id)
    );
    if (!inBatch) {
      return res.status(403).json({ success: false, message: "Not in this batch." });
    }

    let submission = await Submission.findOne({
      assignment: assignment._id,
      student: req.user._id,
    });

    if (submission && submission.status === "graded") {
      return res.status(400).json({
        success: false,
        message: "Already graded. Contact tutor to resubmit.",
      });
    }

    if (submission) {
      submission.content = content || submission.content;
      submission.attachmentUrl = attachmentUrl || submission.attachmentUrl;
      submission.status = "submitted";
      submission.submittedAt = new Date();
      await submission.save();
    } else {
      submission = await Submission.create({
        assignment: assignment._id,
        student: req.user._id,
        content: content || "",
        attachmentUrl: attachmentUrl || "",
        status: "submitted",
      });
    }

    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const requestMeeting = async (req, res) => {
  try {
    const { tutorId, batchId, type, title, message, preferredAt } = req.body;
    if (!tutorId || !title) {
      return res.status(400).json({ success: false, message: "Tutor and title required." });
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== ROLES.TUTOR) {
      return res.status(400).json({ success: false, message: "Invalid tutor." });
    }

    let batch;
    if (batchId) {
      batch = await Batch.findOne({
        _id: batchId,
        students: req.user._id,
        tutor: tutorId,
      });
      if (!batch) {
        return res.status(403).json({
          success: false,
          message: "You are not in this batch with that tutor.",
        });
      }
    } else {
      batch = await Batch.findOne({ tutor: tutorId, students: req.user._id });
      if (!batch) {
        return res.status(403).json({
          success: false,
          message: "No batch found with this tutor.",
        });
      }
    }

    const request = await MeetingRequest.create({
      type: type || "doubt",
      title,
      message: message || "",
      batch: batch._id,
      student: req.user._id,
      tutor: tutorId,
      preferredAt,
      status: "pending",
      createdBy: req.user._id,
    });

    const populated = await MeetingRequest.findById(request._id)
      .populate("tutor", "name email")
      .populate("batch", "name");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyMeetingRequests = async (req, res) => {
  try {
    const requests = await MeetingRequest.find({ student: req.user._id })
      .populate("tutor", "name email")
      .populate("batch", "name")
      .populate("conversation")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTutors = async (req, res) => {
  try {
    const batches = await Batch.find({ students: req.user._id }).populate(
      "tutor",
      "name email role"
    );
    const tutors = batches.filter((b) => b.tutor).map((b) => ({
      ...b.tutor.toObject(),
      batchId: b._id,
      batchName: b.name,
    }));
    const unique = [...new Map(tutors.map((t) => [String(t._id), t])).values()];
    res.json({ success: true, data: unique });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
