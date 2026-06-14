import Batch from "../../models/Batch.js";
import Conversation from "../../models/Conversation.js";
import User from "../../models/User.js";
import { ROLES } from "../../config/roleConfig.js";
import { createVideoRoomId } from "../../utils/videoRoom.js";
import { syncBatchEnrollment } from "../../utils/syncEnrollment.js";

export const createBatch = async (req, res) => {
  try {
    const { name, course, tutor, students, startDate, endDate, maxStudents, status } =
      req.body;

    if (!name || !course) {
      return res.status(400).json({ success: false, message: "Name and course required." });
    }

    if (tutor) {
      const tutorUser = await User.findById(tutor);
      if (!tutorUser || tutorUser.role !== ROLES.TUTOR) {
        return res.status(400).json({ success: false, message: "Invalid tutor." });
      }
    }

    const batch = await Batch.create({
      name,
      course,
      tutor: tutor || null,
      students: students || [],
      startDate,
      endDate,
      maxStudents,
      status,
      createdBy: req.user._id,
    });

    const participantIds = [
      req.user._id,
      ...(tutor ? [tutor] : []),
      ...(students || []),
    ];
    const uniqueParticipants = [
      ...new Map(participantIds.map((id) => [String(id), id])).values(),
    ];
    await Conversation.create({
      title: `${name} — Batch Chat`,
      type: "batch",
      batch: batch._id,
      participants: uniqueParticipants,
      videoRoomId: createVideoRoomId("batch", batch._id),
      createdBy: req.user._id,
    });

    await syncBatchEnrollment(batch);

    const populated = await Batch.findById(batch._id)
      .populate("course", "title")
      .populate("tutor", "name email")
      .populate("students", "name email");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getBatches = async (req, res) => {
  const batches = await Batch.find()
    .populate("course", "title")
    .populate("tutor", "name email")
    .populate("students", "name email")
    .sort({ createdAt: -1 });
  res.json({ success: true, count: batches.length, data: batches });
};

export const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });

    const { tutor, students, name, course, startDate, endDate, maxStudents, status } = req.body;

    if (name !== undefined) batch.name = name;
    if (course !== undefined) batch.course = course;
    if (startDate !== undefined) batch.startDate = startDate || null;
    if (endDate !== undefined) batch.endDate = endDate || null;
    if (maxStudents !== undefined) batch.maxStudents = maxStudents;
    if (status !== undefined) batch.status = status;

    if (tutor !== undefined) {
      if (tutor) {
        const tutorUser = await User.findById(tutor);
        if (!tutorUser || tutorUser.role !== ROLES.TUTOR) {
          return res.status(400).json({ success: false, message: "Invalid tutor." });
        }
      }
      batch.tutor = tutor || null;
    }

    if (students !== undefined) batch.students = students;

    await batch.save();

    const conv = await Conversation.findOne({ batch: batch._id });
    if (conv) {
      const ids = [
        ...conv.participants,
        req.user._id,
        ...(batch.tutor ? [batch.tutor] : []),
        ...(batch.students || []),
      ];
      conv.participants = [...new Map(ids.map((id) => [String(id), id])).values()];
      if (!conv.videoRoomId && !conv.jitsiRoomName) {
        conv.videoRoomId = createVideoRoomId("batch", batch._id);
      }
      await conv.save();
    }

    await syncBatchEnrollment(batch);

    const populated = await Batch.findById(batch._id)
      .populate("course", "title")
      .populate("tutor", "name email")
      .populate("students", "name email");

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });

  await User.updateMany({ batch: batch._id }, { $unset: { batch: 1 } });
  await Conversation.deleteOne({ batch: batch._id });
  await Batch.findByIdAndDelete(batch._id);

  res.json({ success: true, message: "Batch deleted." });
};
