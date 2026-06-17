import JobListing from "../../models/JobListing.js";
import JobApplication from "../../models/JobApplication.js";
import User from "../../models/User.js";
import StudentProfile from "../../models/StudentProfile.js";
import { getPartnerCompany, buildStudentProgressPayload } from "../../utils/partnerHelpers.js";
import { getStudentEnrollments } from "../../utils/studentProgress.js";

export const getPartnerDashboard = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const jobIds = await JobListing.find({ companyRef: company._id }).distinct("_id");
    const [jobCount, applicationCount, recentApplications] = await Promise.all([
      JobListing.countDocuments({ companyRef: company._id, isActive: true }),
      JobApplication.countDocuments({ company: company._id }),
      JobApplication.find({ company: company._id })
        .populate("student", "name email phone")
        .populate("job", "title")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      data: {
        company,
        stats: { jobCount, applicationCount },
        recentApplications,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getPartnerJobs = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const jobs = await JobListing.find({ companyRef: company._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const createPartnerJob = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const { title, description, location, jobType, skills, courseCategories } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Job title is required." });
    }

    const job = await JobListing.create({
      title: title.trim(),
      company: company.name,
      companyRef: company._id,
      description: description || "",
      location: location || "Remote",
      jobType: jobType || "full-time",
      skills: Array.isArray(skills) ? skills : skills ? String(skills).split(",").map((s) => s.trim()) : [],
      courseCategories: Array.isArray(courseCategories)
        ? courseCategories
        : courseCategories
          ? String(courseCategories).split(",").map((s) => s.trim())
          : [],
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const updatePartnerJob = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const job = await JobListing.findOne({ _id: req.params.id, companyRef: company._id });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    const fields = [
      "title",
      "description",
      "location",
      "jobType",
      "skills",
      "courseCategories",
      "isActive",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) job[f] = req.body[f];
    });

    await job.save();
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const deletePartnerJob = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const job = await JobListing.findOne({ _id: req.params.id, companyRef: company._id });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    await JobApplication.deleteMany({ job: job._id });
    await job.deleteOne();
    res.json({ success: true, message: "Job deleted." });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const getPartnerApplications = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const filter = { company: company._id };
    if (req.query.jobId) filter.job = req.query.jobId;

    const applications = await JobApplication.find(filter)
      .populate("student", "name email phone")
      .populate("job", "title jobType location")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getPartnerApplicationDetail = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const application = await JobApplication.findOne({
      _id: req.params.id,
      company: company._id,
    })
      .populate("student", "name email phone avatar")
      .populate("job", "title description jobType location");

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    const [liveProgress, profile, enrollments] = await Promise.all([
      buildStudentProgressPayload(application.student._id),
      StudentProfile.findOne({ user: application.student._id }),
      getStudentEnrollments(application.student._id),
    ]);

    res.json({
      success: true,
      data: {
        application,
        liveProgress,
        profile,
        enrollments,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const company = await getPartnerCompany(req.user._id);
    const application = await JobApplication.findOne({
      _id: req.params.id,
      company: company._id,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    const allowed = ["applied", "reviewing", "shortlisted", "rejected", "hired"];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    application.status = req.body.status;
    await application.save();

    const populated = await JobApplication.findById(application._id)
      .populate("student", "name email phone")
      .populate("job", "title");

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};
