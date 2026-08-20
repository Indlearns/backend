import JobListing from "../models/JobListing.js";

/** Public job listings are removed this many days after posting */
export const PUBLIC_JOB_TTL_DAYS = 10;

export const publicJobExpiryCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PUBLIC_JOB_TTL_DAYS);
  return cutoff;
};

/** Mongo filter: public jobs still within the posting window */
export const publicJobWithinTtlFilter = () => ({
  audience: "public",
  createdAt: { $gte: publicJobExpiryCutoff() },
});

/** Active public jobs visible on the public jobs page */
export const activePublicJobFilter = () => ({
  ...publicJobWithinTtlFilter(),
  isActive: true,
});

/** Delete public jobs older than the TTL (student/partner jobs untouched) */
export const purgeExpiredPublicJobs = async () => {
  const result = await JobListing.deleteMany({
    audience: "public",
    createdAt: { $lt: publicJobExpiryCutoff() },
  });
  return result.deletedCount || 0;
};

export const daysUntilPublicJobExpiry = (createdAt) => {
  if (!createdAt) return 0;
  const expires = new Date(createdAt);
  expires.setDate(expires.getDate() + PUBLIC_JOB_TTL_DAYS);
  const ms = expires.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};
