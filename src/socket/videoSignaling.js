/** In-memory WebRTC signaling rooms (mesh — best for small groups) */
const videoRooms = new Map();

const roomKey = (roomId) => `video_${roomId}`;

const getRoomMap = (roomId) => {
  if (!videoRooms.has(roomId)) videoRooms.set(roomId, new Map());
  return videoRooms.get(roomId);
};

const peerPayload = (socket, user) => ({
  socketId: socket.id,
  userId: String(user._id),
  name: user.name,
  role: user.role,
});

export const registerVideoSignaling = (io, socket, user) => {
  socket.on("join_video_room", ({ roomId, displayName }) => {
    if (!roomId) return;

    const room = getRoomMap(roomId);
    room.set(socket.id, {
      userId: String(user._id),
      name: displayName || user.name,
      role: user.role,
    });

    socket.data.videoRoomId = roomId;
    socket.join(roomKey(roomId));

    const others = [...room.entries()]
      .filter(([sid]) => sid !== socket.id)
      .map(([socketId, meta]) => ({ socketId, ...meta }));

    socket.emit("video_room_users", { roomId, users: others });

    socket.to(roomKey(roomId)).emit("video_user_joined", {
      roomId,
      user: {
        socketId: socket.id,
        userId: String(user._id),
        name: displayName || user.name,
        role: user.role,
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
    if (room.size === 0) videoRooms.delete(id);
  }

  socket.leave(roomKey(id));
  socket.to(roomKey(id)).emit("video_user_left", {
    roomId: id,
    socketId: socket.id,
    userId: String(socket.data.user?._id),
  });
  delete socket.data.videoRoomId;
};

export const handleVideoDisconnect = (io, socket) => {
  leaveVideoRoom(io, socket, socket.data.videoRoomId);
};
