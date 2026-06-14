const normalizeOrigin = (value) =>
  (value || "").replace(/\/+$/, "").toLowerCase();

/** Frontend origin for CORS and email links */
export const getClientUrl = () =>
  normalizeOrigin(process.env.CLIENT_URL || "http://localhost:5173");

const buildAllowedOrigins = () => {
  const origins = new Set([
    getClientUrl(),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  return origins;
};

/**
 * Dynamic CORS — compares origins without trailing slashes,
 * but echoes the browser Origin header exactly (required with credentials).
 */
export const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);

  const allowed = buildAllowedOrigins();
  if (allowed.has(normalizeOrigin(origin))) {
    return callback(null, origin);
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
};

export const corsOptions = {
  origin: corsOrigin,
  credentials: true,
};

export const socketCorsOptions = {
  origin: corsOrigin,
  methods: ["GET", "POST"],
  credentials: true,
};
