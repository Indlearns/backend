import Batch from "../models/Batch.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { ROLES } from "../config/roleConfig.js";
import { createVideoRoomId } from "../utils/videoRoom.js";
import { validateDoubtPair } from "../utils/chatPermissions.js";

const STAFF = [ROLES.SUPERADMIN, ROLES.ADMIN];

const populateConv = (q) =>
  q.populate("batch", "name").populate("participants", "name email role");

const assertStaff = (user) => {
  if (!STAFF.includes(user.role)) {
    const err = new Error("Staff access required.");
    err.status = 403;
    throw err;
  }
};

/** Batches + users grouped by role for admin conversation picker */
export const getStaffDirectory = async (req, res) => {
  try {
    assertStaff(req.user);

    const [batches, users] = await Promise.all([
      Batch.find()
        .populate("course", "title")
        .populate("tutor", "name email role avatar")
        .populate("students", "name email role avatar")
        .sort({ createdAt: -1 }),
      User.find({ isActive: true, _id: { $ne: req.user._id } })
        .select("name email role avatar")
        .sort({ name: 1 }),
    ]);

    const batchList = await Promise.all(
      batches.map(async (b) => {
        const conv = await Conversation.findOne({ batch: b._id, type: "batch" }).select(
          "_id title"
        );
        return {
          _id: b._id,
          name: b.name,
          status: b.status,
          course: b.course,
          tutor: b.tutor,
          students: b.students,
          conversationId: conv?._id || null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        batches: batchList,
        users: {
          superadmin: users.filter((u) => u.role === ROLES.SUPERADMIN),
          admin: users.filter((u) => u.role === ROLES.ADMIN),
          tutor: users.filter((u) => u.role === ROLES.TUTOR),
          student: users.filter((u) => u.role === ROLES.STUDENT),
        },
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** Open (or create) the batch group chat and ensure current admin is a participant */
export const openBatchConversation = async (req, res) => {
  try {
    assertStaff(req.user);

    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found." });
    }

    let conv = await Conversation.findOne({ batch: batch._id, type: "batch" });

    if (!conv) {
      const participantIds = [
        req.user._id,
        ...(batch.tutor ? [batch.tutor] : []),
        ...(batch.students || []),
      ];
      const uniqueParticipants = [
        ...new Map(participantIds.map((id) => [String(id), id])).values(),
      ];
      conv = await Conversation.create({
        title: `${batch.name} — Batch Chat`,
        type: "batch",
        batch: batch._id,
        participants: uniqueParticipants,
        videoRoomId: createVideoRoomId("batch", batch._id),
        createdBy: req.user._id,
      });
    } else {
      const uid = String(req.user._id);
      if (!conv.participants.map(String).includes(uid)) {
        conv.participants.push(req.user._id);
      }
      const ids = [
        ...(batch.tutor ? [batch.tutor] : []),
        ...(batch.students || []),
      ];
      ids.forEach((id) => {
        if (!conv.participants.map(String).includes(String(id))) {
          conv.participants.push(id);
        }
      });
      if (!conv.videoRoomId && !conv.jitsiRoomName) {
        conv.videoRoomId = createVideoRoomId("batch", batch._id);
      }
      await conv.save();
    }

    const populated = await populateConv(Conversation.findById(conv._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** Start or reopen a group chat with selected users (staff only) */
export const startGroupChat = async (req, res) => {
  try {
    assertStaff(req.user);

    const { participantIds = [], title } = req.body;
    const uniqueIds = [
      ...new Set([String(req.user._id), ...participantIds.map(String)]),
    ];

    if (uniqueIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Select at least one other person for a group chat.",
      });
    }

    const users = await User.find({ _id: { $in: uniqueIds }, isActive: true });
    if (users.length !== uniqueIds.length) {
      return res.status(400).json({ success: false, message: "One or more users not found." });
    }

    for (const u of users) {
      if (String(u._id) === String(req.user._id)) continue;
      await validateDoubtPair(req.user, u);
    }

    const existing = await Conversation.find({ type: "group" });
    let conv = existing.find((c) => {
      const set = new Set(c.participants.map(String));
      return set.size === uniqueIds.length && uniqueIds.every((id) => set.has(id));
    });

    if (!conv) {
      const names = users
        .filter((u) => String(u._id) !== String(req.user._id))
        .map((u) => u.name)
        .slice(0, 4);
      const autoTitle =
        title?.trim() ||
        (names.length ? `Group — ${names.join(", ")}` : "Group conversation");

      conv = await Conversation.create({
        title: autoTitle,
        type: "group",
        participants: uniqueIds,
        videoRoomId: createVideoRoomId("group", uniqueIds.sort().join("_")),
        createdBy: req.user._id,
      });
    } else if (title?.trim()) {
      conv.title = title.trim();
      await conv.save();
    }

    const populated = await populateConv(Conversation.findById(conv._id));
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
