import JobListing from "../../models/JobListing.js";
import {
  PUBLIC_JOB_TTL_DAYS,
  activePublicJobFilter,
  daysUntilPublicJobExpiry,
  purgeExpiredPublicJobs,
  publicJobWithinTtlFilter,
} from "../../utils/publicJobExpiry.js";

const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills.map((s) => String(s).trim()).filter(Boolean);
  if (typeof skills === "string") {
    return skills.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const parsePublicJobBody = (body) => {
  const title = body.title?.trim();
  const company = body.company?.trim();
  const applyLink = body.applyLink?.trim();

  if (!title) throw Object.assign(new Error("Job title is required."), { status: 400 });
  if (!company) throw Object.assign(new Error("Company name is required."), { status: 400 });
  if (!applyLink) throw Object.assign(new Error("Apply link is required."), { status: 400 });

  return {
    title,
    company,
    description: body.description?.trim() || "",
    location: body.location?.trim() || "Remote",
    jobType: body.jobType || "full-time",
    skills: parseSkills(body.skills),
    applyLink,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    audience: "public",
    companyRef: null,
    courseCategories: [],
  };
};

export const createPublicJob = async (req, res) => {
  try {
    const data = parsePublicJobBody(req.body);
    const job = await JobListing.create({ ...data, createdBy: req.user._id });
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const getPublicJobsAdmin = async (req, res) => {
  await purgeExpiredPublicJobs();
  const jobs = await JobListing.find(publicJobWithinTtlFilter())
    .sort({ createdAt: -1 })
    .lean();
  const data = jobs.map((job) => ({
    ...job,
    daysRemaining: daysUntilPublicJobExpiry(job.createdAt),
  }));
  res.json({ success: true, count: data.length, data });
};

export const updatePublicJob = async (req, res) => {
  try {
    const job = await JobListing.findOne({ _id: req.params.id, audience: "public" });
    if (!job) {
      return res.status(404).json({ success: false, message: "Public job not found." });
    }

    if (req.body.title !== undefined) job.title = req.body.title.trim();
    if (req.body.company !== undefined) job.company = req.body.company.trim();
    if (req.body.description !== undefined) job.description = req.body.description;
    if (req.body.location !== undefined) job.location = req.body.location;
    if (req.body.jobType !== undefined) job.jobType = req.body.jobType;
    if (req.body.skills !== undefined) job.skills = parseSkills(req.body.skills);
    if (req.body.applyLink !== undefined) {
      const link = req.body.applyLink.trim();
      if (!link) {
        return res.status(400).json({ success: false, message: "Apply link is required." });
      }
      job.applyLink = link;
    }
    if (req.body.isActive !== undefined) job.isActive = Boolean(req.body.isActive);

    await job.save();
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deletePublicJob = async (req, res) => {
  const job = await JobListing.findOne({ _id: req.params.id, audience: "public" });
  if (!job) {
    return res.status(404).json({ success: false, message: "Public job not found." });
  }
  await job.deleteOne();
  res.json({ success: true, message: "Public job deleted." });
};
