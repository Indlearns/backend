import ClassSchedule from "../models/ClassSchedule.js";
import Batch from "../models/Batch.js";
import { ensureVideoRoomId } from "./videoRoom.js";
import { getIceServers } from "../config/iceConfig.js";
import { canJoinClass, syncScheduleParticipants } from "./classAccess.js";

export const joinLiveClassForUser = async (scheduleId, user) => {
  const schedule = await ClassSchedule.findById(scheduleId).populate("batch");
  if (!schedule) {
    const err = new Error("Class not found.");
    err.status = 404;
    throw err;
  }

  let batch = schedule.batch;
  if (!batch?.students) {
    batch = await Batch.findById(schedule.batch?._id || schedule.batch);
  }

  await syncScheduleParticipants(schedule, batch);

  if (!canJoinClass(user, schedule, batch)) {
    const err = new Error("You are not added to this class.");
    err.status = 403;
    throw err;
  }

  if (schedule.status === "scheduled") {
    schedule.status = "live";
    await schedule.save();
  }

  if (schedule.status === "cancelled") {
    const err = new Error("This class was cancelled.");
    err.status = 400;
    throw err;
  }

  const roomId = await ensureVideoRoomId(schedule, "class", "_id");

  return {
    schedule,
    roomId,
    roomName: roomId,
    iceServers: getIceServers(),
  };
};
