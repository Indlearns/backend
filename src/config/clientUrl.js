const normalizeOrigin = (value) =>
  (value || "").replace(/\/+$/, "").toLowerCase();

/** Frontend origin for CORS and email links */
export const getClientUrl = () =>
  normalizeOrigin(process.env.CLIENT_URL || "http://localhost:5173");

const withWwwVariants = (origin) => {
  const variants = new Set([origin]);
  if (!origin) return variants;

  try {
    const url = new URL(origin.startsWith("http") ? origin : `https://${origin}`);
    const host = url.hostname;
    if (host.startsWith("www.")) {
      variants.add(`${url.protocol}//${host.slice(4)}`);
    } else {
      variants.add(`${url.protocol}//www.${host}`);
    }
  } catch {
    // ignore invalid URL
  }
  return variants;
};

const buildAllowedOrigins = () => {
  const origins = new Set([
    ...withWwwVariants(getClientUrl()),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://indlearns.com",
    "https://www.indlearns.com",
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
