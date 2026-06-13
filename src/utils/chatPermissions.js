import Batch from "../models/Batch.js";
import User from "../models/User.js";
import { ROLES } from "../config/roleConfig.js";

const STAFF = [ROLES.SUPERADMIN, ROLES.ADMIN];

/** Who can start a 1-on-1 doubt chat with whom */
export const canDoubtChat = (userRole, targetRole) => {
  if (userRole === ROLES.SUPERADMIN) return true;
  if (userRole === ROLES.ADMIN) {
    return [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TUTOR, ROLES.STUDENT].includes(
      targetRole
    );
  }
  if (userRole === ROLES.TUTOR) {
    return [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.STUDENT].includes(targetRole);
  }
  if (userRole === ROLES.STUDENT) {
    return [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TUTOR, ROLES.STUDENT].includes(
      targetRole
    );
  }
  return false;
};

/** Students in same batch can peer chat */
export const shareBatch = async (studentIdA, studentIdB) => {
  const batches = await Batch.find({
    students: { $all: [studentIdA, studentIdB] },
  });
  return batches.length > 0;
};

export const validateDoubtPair = async (user, targetUser) => {
  if (!targetUser?.isActive) {
    throw new Error("User not available.");
  }
  if (String(user._id) === String(targetUser._id)) {
    throw new Error("Cannot chat with yourself.");
  }
  if (!canDoubtChat(user.role, targetUser.role)) {
    throw new Error("You are not allowed to chat with this role.");
  }
  if (user.role === ROLES.STUDENT && targetUser.role === ROLES.STUDENT) {
    const ok = await shareBatch(user._id, targetUser._id);
    if (!ok) throw new Error("Students must be in the same batch to chat.");
  }
  if (user.role === ROLES.TUTOR && targetUser.role === ROLES.STUDENT) {
    const batch = await Batch.findOne({
      tutor: user._id,
      students: targetUser._id,
    });
    if (!batch) throw new Error("This student is not in your batch.");
  }
  if (user.role === ROLES.STUDENT && targetUser.role === ROLES.TUTOR) {
    const batch = await Batch.findOne({
      tutor: targetUser._id,
      students: user._id,
    });
    if (!batch) throw new Error("This tutor is not assigned to your batch.");
  }
};

/** Contacts user can start a doubt chat with */
export const getAllowedContactsQuery = async (user) => {
  const { role, _id } = user;

  if (role === ROLES.SUPERADMIN) {
    return User.find({ isActive: true, _id: { $ne: _id } }).select(
      "name email role avatar"
    );
  }

  if (role === ROLES.ADMIN) {
    return User.find({
      isActive: true,
      _id: { $ne: _id },
      role: { $in: [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TUTOR, ROLES.STUDENT] },
    }).select("name email role avatar");
  }

  if (role === ROLES.TUTOR) {
    const batches = await Batch.find({ tutor: _id }).select("students");
    const studentIds = [...new Set(batches.flatMap((b) => b.students.map(String)))];
    return User.find({
      isActive: true,
      $or: [
        { role: { $in: [ROLES.SUPERADMIN, ROLES.ADMIN] } },
        { _id: { $in: studentIds } },
      ],
    })
      .select("name email role avatar")
      .limit(200);
  }

  if (role === ROLES.STUDENT) {
    const batches = await Batch.find({ students: _id })
      .populate("tutor", "name email role avatar")
      .populate("students", "name email role avatar");
    const peerIds = new Set();
    const contacts = [];
    batches.forEach((b) => {
      if (b.tutor) contacts.push(b.tutor);
      b.students.forEach((s) => {
        if (String(s._id) !== String(_id)) peerIds.add(String(s._id));
      });
    });
    const peers = await User.find({ _id: { $in: [...peerIds] } }).select(
      "name email role avatar"
    );
    const staff = await User.find({
      isActive: true,
      role: { $in: STAFF },
    }).select("name email role avatar");
    const map = new Map();
    [...contacts, ...peers, ...staff].forEach((u) => map.set(String(u._id), u));
    return [...map.values()];
  }

  return [];
};
