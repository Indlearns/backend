import ClassSchedule from "../../models/ClassSchedule.js";
import Batch from "../../models/Batch.js";
import { createVideoRoomId } from "../../utils/videoRoom.js";

export const createSchedule = async (req, res) => {
  try {
    const { batch, title, date, startTime, endTime, meetLink, tutor, notes } = req.body;
    const batchDoc = await Batch.findById(batch);
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: "Batch not found." });
    }

    const schedule = await ClassSchedule.create({
      batch,
      title,
      date,
      startTime,
      endTime,
      meetLink,
      tutor: tutor || batchDoc.tutor,
      notes,
      videoRoomId: createVideoRoomId("class", `${batch}_${date}_${startTime}`),
      createdBy: req.user._id,
    });

    const populated = await ClassSchedule.findById(schedule._id)
      .populate("batch", "name")
      .populate("tutor", "name email");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getSchedules = async (req, res) => {
  const filter = {};
  if (req.query.batch) filter.batch = req.query.batch;

  const schedules = await ClassSchedule.find(filter)
    .populate("batch", "name course")
    .populate({ path: "batch", populate: { path: "course", select: "title" } })
    .populate("tutor", "name email")
    .sort({ date: 1, startTime: 1 });

  res.json({ success: true, count: schedules.length, data: schedules });
};

export const updateSchedule = async (req, res) => {
  const schedule = await ClassSchedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate("batch", "name")
    .populate("tutor", "name email");

  if (!schedule) return res.status(404).json({ success: false, message: "Class not found." });
  res.json({ success: true, data: schedule });
};

export const deleteSchedule = async (req, res) => {
  const schedule = await ClassSchedule.findByIdAndDelete(req.params.id);
  if (!schedule) return res.status(404).json({ success: false, message: "Class not found." });
  res.json({ success: true, message: "Class deleted." });
};
