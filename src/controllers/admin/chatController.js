import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";

export const getConversations = async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
  })
    .populate("batch", "name")
    .populate("participants", "name email role")
    .sort({ lastMessageAt: -1 });

  res.json({ success: true, count: conversations.length, data: conversations });
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

    const populated = await Conversation.findById(conv._id)
      .populate("batch", "name")
      .populate("participants", "name email role");

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  const conv = await Conversation.findById(req.params.id);
  if (!conv) return res.status(404).json({ success: false, message: "Chat not found." });

  const messages = await Message.find({ conversation: req.params.id })
    .populate("sender", "name email role")
    .sort({ createdAt: 1 });

  res.json({ success: true, count: messages.length, data: messages });
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
