import crypto from "crypto";

/** Unique Jitsi room name (safe characters only) */
export const createJitsiRoomName = (prefix, id) => {
  const hash = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 12);
  return `IndLearn_${prefix}_${hash}`;
};

export const getJitsiDomain = () =>
  process.env.JITSI_DOMAIN || "meet.jit.si";

export const buildJitsiUrl = (roomName, displayName = "User") => {
  const domain = getJitsiDomain();
  const name = encodeURIComponent(displayName);
  return `https://${domain}/${roomName}#userInfo.displayName="${name}"`;
};
