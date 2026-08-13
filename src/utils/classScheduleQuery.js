import Batch from "../models/Batch.js";
import { ROLES } from "../config/roleConfig.js";
import { isStaffAdmin } from "./classAccess.js";

/** Start of yesterday UTC — keeps today's classes visible in all timezones */
export const classListCutoffDate = () => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
};

/** Upcoming / live classes — live sessions always shown; scheduled from yesterday onward */
export const buildUpcomingClassTimeFilter = () => {
  const cutoff = classListCutoffDate();

  return {
    status: { $in: ["scheduled", "live"] },
    $or: [{ status: "live" }, { date: { $gte: cutoff } }],
  };
};

export const buildLiveClassAccessFilter = async (user) => {
  if (!user) return { _id: null };

  if (isStaffAdmin(user.role)) {
    return {};
  }

  if (user.role === ROLES.TUTOR) {
    const batches = await Batch.find({ tutor: user._id }).select("_id");
    const batchIds = batches.map((b) => b._id);
    const or = [{ tutor: user._id }, { participants: user._id }];
    if (batchIds.length) or.push({ batch: { $in: batchIds } });
    return { $or: or };
  }

  if (user.role === ROLES.STUDENT) {
    const batches = await Batch.find({ students: user._id }).select("_id");
    const batchIds = batches.map((b) => b._id);
    const or = [{ participants: user._id }];
    if (batchIds.length) or.push({ batch: { $in: batchIds } });
    return or.length ? { $or: or } : { _id: null };
  }

  return { _id: null };
};

export const buildLiveClassListFilter = async (user) => {
  const timeFilter = buildUpcomingClassTimeFilter();
  const accessFilter = await buildLiveClassAccessFilter(user);

  if (accessFilter._id === null) return accessFilter;

  if (isStaffAdmin(user?.role)) {
    return timeFilter;
  }

  return { $and: [timeFilter, accessFilter] };
};
