import Batch from "../../models/Batch.js";
import Conversation from "../../models/Conversation.js";
import User from "../../models/User.js";
import { ROLES } from "../../config/roleConfig.js";
import { createVideoRoomId } from "../../utils/videoRoom.js";
import { syncBatchEnrollment } from "../../utils/syncEnrollment.js";
import { syncEnrolledStudentsIntoBatch } from "../../utils/batchStudentSync.js";
import {
  notifyTutorBatchAssignment,
  notifyStudentsAddedToBatch,
} from "../../utils/enrollmentEmail.js";
import {
  normalizeBatchSourceType,
  populateBatchSource,
  resolveBatchSource,
} from "../../utils/batchSource.js";

export const createBatch = async (req, res) => {
  try {
    const { name, tutor, students, startDate, endDate, maxStudents, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Batch name is required." });
    }

    const source = await resolveBatchSource({
      sourceType: req.body.sourceType,
      course: req.body.course,
      workshop: req.body.workshop,
    });

    if (tutor) {
      const tutorUser = await User.findById(tutor);
      if (!tutorUser || tutorUser.role !== ROLES.TUTOR) {
        return res.status(400).json({ success: false, message: "Invalid tutor." });
      }
    }

    const batch = await Batch.create({
      name,
      sourceType: source.sourceType,
      course: source.course,
      workshop: source.workshop,
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

    const syncResult = await syncEnrolledStudentsIntoBatch(batch);
    await syncBatchEnrollment(batch);

    if (tutor) {
      notifyTutorBatchAssignment(batch, tutor).catch(() => {});
    }
    if (syncResult.added > 0 && syncResult.summary) {
      notifyStudentsAddedToBatch(syncResult.addedStudentIds, syncResult.summary).catch(
        () => {}
      );
    }

    const populated = await populateBatchSource(
      Batch.findById(batch._id)
        .populate("tutor", "name email")
        .populate("students", "name email")
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const getBatches = async (req, res) => {
  const batches = await populateBatchSource(
    Batch.find()
      .populate("tutor", "name email")
      .populate("students", "name email")
      .sort({ createdAt: -1 })
  );
  res.json({ success: true, count: batches.length, data: batches });
};

export const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });

    const { tutor, students, name, startDate, endDate, maxStudents, status } = req.body;

    if (name !== undefined) batch.name = name;
    if (startDate !== undefined) batch.startDate = startDate || null;
    if (endDate !== undefined) batch.endDate = endDate || null;
    if (maxStudents !== undefined) batch.maxStudents = maxStudents;
    if (status !== undefined) batch.status = status;

    const sourceChanging =
      req.body.sourceType !== undefined ||
      req.body.course !== undefined ||
      req.body.workshop !== undefined;

    if (sourceChanging) {
      const source = await resolveBatchSource({
        sourceType: req.body.sourceType ?? batch.sourceType,
        course: req.body.course !== undefined ? req.body.course : batch.course,
        workshop: req.body.workshop !== undefined ? req.body.workshop : batch.workshop,
      });
      batch.sourceType = source.sourceType;
      batch.course = source.course;
      batch.workshop = source.workshop;
    } else if (!batch.sourceType) {
      batch.sourceType = normalizeBatchSourceType(
        batch.workshop ? "workshop" : "course"
      );
    }

    const previousTutor = batch.tutor ? String(batch.tutor) : "";

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

    const syncResult = await syncEnrolledStudentsIntoBatch(batch);

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

    const newTutor = batch.tutor ? String(batch.tutor) : "";
    if (newTutor && newTutor !== previousTutor) {
      notifyTutorBatchAssignment(batch, batch.tutor).catch(() => {});
    }
    if (syncResult.added > 0 && syncResult.summary) {
      notifyStudentsAddedToBatch(syncResult.addedStudentIds, syncResult.summary).catch(
        () => {}
      );
    }

    const populated = await populateBatchSource(
      Batch.findById(batch._id)
        .populate("tutor", "name email")
        .populate("students", "name email")
    );

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
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
