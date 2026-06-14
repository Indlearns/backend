import { ROLES } from "../config/roleConfig.js";
import Batch from "../models/Batch.js";

export const isStaffAdmin = (role) =>
  [ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);

/** Build participant list: batch students + tutor + creator */
export const buildParticipantsFromBatch = (batchDoc, extraUserIds = []) => {
  const ids = new Set();
  for (const sid of batchDoc?.students || []) ids.add(String(sid));
  if (batchDoc?.tutor) ids.add(String(batchDoc.tutor));
  for (const id of extraUserIds) {
    if (id) ids.add(String(id));
  }
  return [...ids];
};

export const canJoinClass = (user, schedule, batch) => {
  if (!user || !schedule) return false;
  if (isStaffAdmin(user.role)) return true;

  const uid = String(user._id);
  if (String(schedule.tutor) === uid) return true;
  if (batch && String(batch.tutor) === uid) return true;
  if (schedule.participants?.some((p) => String(p._id || p) === uid)) return true;
  if (batch?.students?.some((s) => String(s._id || s) === uid)) return true;

  return false;
};

export const canStartClass = (user, schedule, batch) => canJoinClass(user, schedule, batch);

export const syncScheduleParticipants = async (schedule, batchDoc) => {
  if (!batchDoc) {
    batchDoc = await Batch.findById(schedule.batch?._id || schedule.batch);
  }
  if (!batchDoc) return schedule;

  const participantIds = buildParticipantsFromBatch(batchDoc, [
    schedule.createdBy,
    schedule.tutor,
  ]);

  const current = (schedule.participants || []).map(String).sort().join(",");
  const next = participantIds.map(String).sort().join(",");

  if (current !== next) {
    schedule.participants = participantIds;
    await schedule.save();
  }

  return schedule;
};
