import JobListing from "../../models/JobListing.js";
import JobApplication from "../../models/JobApplication.js";
import { buildStudentProgressPayload } from "../../utils/partnerHelpers.js";

export const applyToJob = async (req, res) => {
  try {
    const job = await JobListing.findById(req.params.jobId);
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: "Job not found or closed." });
    }

    if (!job.companyRef) {
      return res.status(400).json({
        success: false,
        message: "This job only accepts external applications.",
      });
    }

    const existing = await JobApplication.findOne({
      job: job._id,
      student: req.user._id,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this job.",
        data: existing,
      });
    }

    const progressSnapshot = await buildStudentProgressPayload(req.user._id);

    const application = await JobApplication.create({
      job: job._id,
      company: job.companyRef,
      student: req.user._id,
      coverNote: req.body.coverNote || "",
      progressSnapshot,
    });

    const populated = await JobApplication.findById(application._id)
      .populate("job", "title company")
      .populate("company", "name");

    res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Already applied to this job." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyApplications = async (req, res) => {
  const applications = await JobApplication.find({ student: req.user._id })
    .populate("job", "title company jobType location isActive")
    .populate("company", "name website")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: applications });
};
