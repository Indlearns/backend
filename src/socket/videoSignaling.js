/** In-memory WebRTC signaling rooms (mesh — best for small groups) */
const videoRooms = new Map();
const videoChatHistory = new Map();
const MAX_CHAT_HISTORY = 80;

const roomKey = (roomId) => `video_${roomId}`;

const getRoomMap = (roomId) => {
  if (!videoRooms.has(roomId)) videoRooms.set(roomId, new Map());
  return videoRooms.get(roomId);
};

const getChatHistory = (roomId) => {
  if (!videoChatHistory.has(roomId)) videoChatHistory.set(roomId, []);
  return videoChatHistory.get(roomId);
};

const pushChatMessage = (roomId, message) => {
  const history = getChatHistory(roomId);
  history.push(message);
  if (history.length > MAX_CHAT_HISTORY) {
    history.splice(0, history.length - MAX_CHAT_HISTORY);
  }
};

const peerPayload = (socket, user) => ({
  socketId: socket.id,
  userId: String(user._id),
  name: user.name,
  role: user.role,
});

const userMetaFromRoom = (roomId, socket) => {
  const room = videoRooms.get(roomId);
  return room?.get(socket.id);
};

export const registerVideoSignaling = (io, socket, user) => {
  socket.on("join_video_room", ({ roomId, displayName }) => {
    if (!roomId) return;

    const room = getRoomMap(roomId);
    room.set(socket.id, {
      userId: String(user._id),
      name: displayName || user.name,
      role: user.role,
      handRaised: false,
    });

    socket.data.videoRoomId = roomId;
    socket.data.videoDisplayName = displayName || user.name;
    socket.join(roomKey(roomId));

    const others = [...room.entries()]
      .filter(([sid]) => sid !== socket.id)
      .map(([socketId, meta]) => ({
        socketId,
        userId: meta.userId,
        name: meta.name,
        role: meta.role,
        handRaised: Boolean(meta.handRaised),
      }));

    socket.emit("video_room_users", { roomId, users: others });
    socket.emit("video_chat_history", { roomId, messages: getChatHistory(roomId) });

    socket.to(roomKey(roomId)).emit("video_user_joined", {
      roomId,
      user: {
        socketId: socket.id,
        userId: String(user._id),
        name: displayName || user.name,
        role: user.role,
        handRaised: false,
      },
    });
  });

  socket.on("video_signal", ({ roomId, to, signal }) => {
    if (!roomId || !to || !signal) return;
    io.to(to).emit("video_signal", {
      roomId,
      from: socket.id,
      signal,
      user: peerPayload(socket, user),
    });
  });

  socket.on("video_raise_hand", ({ roomId, raised }) => {
    if (!roomId) return;
    const meta = userMetaFromRoom(roomId, socket);
    if (!meta) return;

    meta.handRaised = Boolean(raised);
    const payload = {
      roomId,
      socketId: socket.id,
      userId: String(user._id),
      name: meta.name,
      raised: meta.handRaised,
    };

    io.to(roomKey(roomId)).emit("video_hand_update", payload);
  });

  socket.on("video_chat_message", ({ roomId, text }) => {
    if (!roomId || !text?.trim()) return;
    const meta = userMetaFromRoom(roomId, socket);
    if (!meta) return;

    const message = {
      id: `${Date.now()}_${socket.id}`,
      socketId: socket.id,
      userId: String(user._id),
      name: meta.name,
      role: user.role,
      text: text.trim().slice(0, 500),
      at: new Date().toISOString(),
    };

    pushChatMessage(roomId, message);
    io.to(roomKey(roomId)).emit("video_chat_message", { roomId, message });
  });

  socket.on("leave_video_room", ({ roomId }) => {
    leaveVideoRoom(io, socket, roomId);
  });
};

export const leaveVideoRoom = (io, socket, roomId) => {
  const id = roomId || socket.data.videoRoomId;
  if (!id) return;

  const room = videoRooms.get(id);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) {
      videoRooms.delete(id);
      videoChatHistory.delete(id);
    }
  }

  socket.leave(roomKey(id));
  socket.to(roomKey(id)).emit("video_user_left", {
    roomId: id,
    socketId: socket.id,
    userId: String(socket.data.user?._id),
  });
  socket.to(roomKey(id)).emit("video_hand_update", {
    roomId: id,
    socketId: socket.id,
    raised: false,
  });
  delete socket.data.videoRoomId;
};

export const handleVideoDisconnect = (io, socket) => {
  leaveVideoRoom(io, socket, socket.data.videoRoomId);
};
