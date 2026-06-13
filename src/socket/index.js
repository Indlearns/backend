import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const getSocketUser = async (socket) => {
  const token = socket.handshake.auth?.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.id).select("name email role");
  } catch {
    return null;
  }
};

export const initSocket = (io) => {
  io.on("connection", async (socket) => {
    const user = await getSocketUser(socket);
    if (!user) {
      socket.disconnect();
      return;
    }

    socket.data.user = user;
    console.log(`Socket connected: ${user.email} (${user.role})`);

    socket.on("join_conversation", (conversationId) => {
      socket.join(`conv_${conversationId}`);
    });

    socket.on("send_message", async ({ conversationId, content }) => {
      try {
        if (!content?.trim()) return;

        const conv = await Conversation.findById(conversationId);
        if (!conv) return;

        const uid = String(user._id);
        if (!conv.participants.map(String).includes(uid)) {
          conv.participants.push(user._id);
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: user._id,
          content: content.trim(),
          readBy: [user._id],
        });

        conv.lastMessageAt = new Date();
        await conv.save();

        const populated = await Message.findById(message._id).populate(
          "sender",
          "name email role"
        );

        io.to(`conv_${conversationId}`).emit("new_message", populated);
      } catch (err) {
        socket.emit("error_message", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${user.email}`);
    });
  });
};
