import crypto from "crypto";

/** Unique IndLearn video room id (safe characters only) */
export const createVideoRoomId = (prefix, id) => {
  const hash = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 12);
  return `IndLearn_${prefix}_${hash}`;
};

/** Read room id from legacy or new MongoDB field */
export const getDocVideoRoomId = (doc) => doc?.videoRoomId || doc?.jitsiRoomName || "";

export const ensureVideoRoomId = async (doc, prefix, idField) => {
  let roomId = getDocVideoRoomId(doc);
  if (!roomId) {
    roomId = createVideoRoomId(prefix, doc[idField] || doc._id);
    doc.videoRoomId = roomId;
    await doc.save();
  }
  return roomId;
};
