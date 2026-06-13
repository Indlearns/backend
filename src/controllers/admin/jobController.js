import JobListing from "../../models/JobListing.js";

export const createJob = async (req, res) => {
  try {
    const job = await JobListing.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getJobs = async (req, res) => {
  const jobs = await JobListing.find().sort({ createdAt: -1 });
  res.json({ success: true, data: jobs });
};

export const updateJob = async (req, res) => {
  const job = await JobListing.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!job) return res.status(404).json({ success: false, message: "Job not found." });
  res.json({ success: true, data: job });
};

export const deleteJob = async (req, res) => {
  await JobListing.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Job deleted." });
};
