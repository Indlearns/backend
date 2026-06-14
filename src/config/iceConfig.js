/** WebRTC ICE servers — STUN is free; add TURN via ICE_SERVERS JSON in production if needed */
export const getIceServers = () => {
  if (process.env.ICE_SERVERS) {
    try {
      return JSON.parse(process.env.ICE_SERVERS);
    } catch {
      console.warn("Invalid ICE_SERVERS JSON — using defaults");
    }
  }

  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
};
