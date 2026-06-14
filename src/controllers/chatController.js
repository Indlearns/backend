import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Batch from "../models/Batch.js";
import ClassSchedule from "../models/ClassSchedule.js";
import User from "../models/User.js";
import { ROLES } from "../config/roleConfig.js";
import { validateDoubtPair, getAllowedContactsQuery } from "../utils/chatPermissions.js";
import { createVideoRoomId, ensureVideoRoomId } from "../utils/videoRoom.js";
import { getIceServers } from "../config/iceConfig.js";
import { syncScheduleParticipants } from "../utils/classAccess.js";
import { joinLiveClassForUser } from "../utils/classScheduleJoin.js";

const populateConv = (q) =>
  q.populate("batch", "name").populate("participants", "name email role");

export const getConversations = async (req, res) => {
  try {
    const conversations = await populateConv(
      Conversation.find({ participants: req.user._id })
    ).sort({ lastMessageAt: -1 });

    res.json({ success: true, count: conversations.length, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getContacts = async (req, res) => {
  try {
    const contacts = await getAllowedContactsQuery(req.user);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const startDoubtChat = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const target = await User.findById(targetUserId);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    await validateDoubtPair(req.user, target);

    const pair = [req.user._id, target._id];
    const existing = await Conversation.find({
      type: { $in: ["doubt", "student_peer"] },
      participants: { $all: pair },
    });
    let conv = existing.find((c) => c.participants.length === 2);

    if (!conv) {
      const isPeer =
        req.user.role === ROLES.STUDENT && target.role === ROLES.STUDENT;
      const key = [String(req.user._id), String(target._id)].sort().join("_");
      conv = await Conversation.create({
        title: isPeer
          ? `Peer chat — ${target.name}`
          : `Doubt — ${req.user.name} & ${target.name}`,
        type: isPeer ? "student_peer" : "doubt",
        participants: pair,
        videoRoomId: createVideoRoomId("doubt", key),
        createdBy: req.user._id,
      });
    }

    const populated = await populateConv(Conversation.findById(conv._id));
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const joinConversation = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: "Chat not found." });

    const uid = String(req.user._id);
    if (!conv.participants.map(String).includes(uid)) {
      conv.participants.push(req.user._id);
      await conv.save();
    }

    const populated = await populateConv(Conversation.findById(conv._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: "Chat not found." });

    const messages = await Message.find({ conversation: req.params.id })
      .populate("sender", "name email role")
      .sort({ createdAt: 1 });

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: "Message required." });
    }

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: "Chat not found." });

    const uid = String(req.user._id);
    if (!conv.participants.map(String).includes(uid)) {
      conv.participants.push(req.user._id);
    }

    const message = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      content: content.trim(),
      readBy: [req.user._id],
    });

    conv.lastMessageAt = new Date();
    await conv.save();

    const populated = await Message.findById(message._id).populate(
      "sender",
      "name email role"
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVideoConfig = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: "Chat not found." });

    const roomId = await ensureVideoRoomId(conv, "room", "_id");

    res.json({
      success: true,
      data: {
        roomId,
        roomName: roomId,
        iceServers: getIceServers(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Live classes — role-based listing */
export const getLiveClasses = async (req, res) => {
  try {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    let filter = {
      date: { $gte: today },
      status: { $in: ["scheduled", "live"] },
    };

    if (req.user.role === ROLES.TUTOR) {
      filter.$or = [{ tutor: req.user._id }, { participants: req.user._id }];
    } else if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
      // staff sees all upcoming / live classes
    } else if (req.user.role === ROLES.STUDENT) {
      filter.participants = req.user._id;
    }

    const schedules = await ClassSchedule.find(filter)
      .populate("batch", "name course")
      .populate({ path: "batch", populate: { path: "course", select: "title" } })
      .populate("tutor", "name email")
      .populate("participants", "name email role")
      .sort({ date: 1, startTime: 1 });

    for (const s of schedules) {
      await syncScheduleParticipants(s, s.batch);
      await ensureVideoRoomId(s, "class", "_id");
    }

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Start (if scheduled) and join video room */
export const joinLiveClass = async (req, res) => {
  try {
    const data = await joinLiveClassForUser(req.params.scheduleId, req.user);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getLiveClassVideo = async (req, res) => {
  try {
    const data = await joinLiveClassForUser(req.params.scheduleId, req.user);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
