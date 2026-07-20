import Batch from "../../models/Batch.js";
import CoursePurchase from "../../models/CoursePurchase.js";
import WorkshopPurchase from "../../models/WorkshopPurchase.js";
import Assignment from "../../models/Assignment.js";
import Submission from "../../models/Submission.js";
import ClassSchedule from "../../models/ClassSchedule.js";
import Conversation from "../../models/Conversation.js";
import StudentProfile from "../../models/StudentProfile.js";
import JobListing from "../../models/JobListing.js";
import JobApplication from "../../models/JobApplication.js";
import User from "../../models/User.js";
import {
  getStudentEnrollments,
  computeBatchProgress,
} from "../../utils/studentProgress.js";
import { isHackathonEventType } from "../../utils/workshopVisibility.js";

const WORKSHOP_EVENT_FIELDS =
  "title description eventType date startTime endTime meetLink status price currency registrationCloseDate";

export const getEnrollmentStatus = async (req, res) => {
  try {
    const batchCount = await Batch.countDocuments({ students: req.user._id });
    const [purchaseCount, workshopRegCount, user] = await Promise.all([
      CoursePurchase.countDocuments({ student: req.user._id, status: "paid" }),
      WorkshopPurchase.countDocuments({ student: req.user._id, status: "paid" }),
      User.findById(req.user._id).select("enrolledCourses registeredWorkshops"),
    ]);
    const enrolledCourseCount = user?.enrolledCourses?.length || 0;
    const registeredWorkshopCount = user?.registeredWorkshops?.length || 0;
    const eventRegCount = Math.max(workshopRegCount, registeredWorkshopCount);
    const enrolled =
      batchCount > 0 ||
      purchaseCount > 0 ||
      enrolledCourseCount > 0 ||
      eventRegCount > 0;

    res.json({
      success: true,
      data: {
        enrolled,
        batchCount,
        purchasedCourseCount: Math.max(purchaseCount, enrolledCourseCount),
        registeredWorkshopCount: eventRegCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyEvents = async (req, res) => {
  try {
    const [purchases, user] = await Promise.all([
      WorkshopPurchase.find({ student: req.user._id, status: "paid" })
        .populate("workshop", WORKSHOP_EVENT_FIELDS)
        .sort({ createdAt: -1 }),
      User.findById(req.user._id).populate("registeredWorkshops", WORKSHOP_EVENT_FIELDS),
    ]);

    const byId = new Map();

    for (const purchase of purchases) {
      if (!purchase.workshop?._id) continue;
      byId.set(String(purchase.workshop._id), {
        ...purchase.workshop.toObject(),
        registeredAt: purchase.createdAt,
        paymentGateway: purchase.paymentGateway,
      });
    }

    for (const workshop of user?.registeredWorkshops || []) {
      if (!workshop?._id || byId.has(String(workshop._id))) continue;
      byId.set(String(workshop._id), {
        ...workshop.toObject(),
        registeredAt: null,
        paymentGateway: "free",
      });
    }

    const all = [...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
    const workshops = all.filter((item) => !isHackathonEventType(item.eventType));
    const hackathons = all.filter((item) => isHackathonEventType(item.eventType));

    res.json({
      success: true,
      data: { workshops, hackathons },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyCourses = async (req, res) => {
  try {
    const enrollments = await getStudentEnrollments(req.user._id);
    const purchases = await CoursePurchase.find({
      student: req.user._id,
      status: "paid",
    })
      .populate("course", "title description category duration thumbnail price")
      .populate("workshop", "title description eventType date startTime endTime price");

    const batchCourseIds = new Set(
      enrollments.map((e) => String(e.batch?.course?._id || e.batch?.course))
    );

    const purchasedCourses = purchases
      .filter((p) => p.course && !batchCourseIds.has(String(p.course._id)))
      .map((p) => ({
        type: "purchase",
        course: p.course,
        purchasedAt: p.createdAt,
      }));

    res.json({
      success: true,
      count: enrollments.length + purchasedCourses.length,
      data: enrollments,
      purchasedCourses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourseDashboard = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      students: req.user._id,
    })
      .populate("course", "title description category level duration")
      .populate("workshop", "title description eventType date startTime endTime")
      .populate("tutor", "name email phone");

    if (!batch) {
      return res.status(404).json({ success: false, message: "Enrollment not found." });
    }

    const [progress, schedules, assignments, conversation] = await Promise.all([
      computeBatchProgress(req.user._id, batch._id),
      ClassSchedule.find({ batch: batch._id }).sort({ date: 1 }).limit(10),
      Assignment.find({ batch: batch._id, isPublished: true }).sort({ createdAt: -1 }),
      Conversation.findOne({ batch: batch._id, type: "batch" }),
    ]);

    const subs = await Submission.find({
      student: req.user._id,
      assignment: { $in: assignments.map((a) => a._id) },
    });
    const subMap = Object.fromEntries(subs.map((s) => [String(s.assignment), s]));

    res.json({
      success: true,
      data: {
        batch,
        progress,
        schedules,
        assignments: assignments.map((a) => ({
          ...a.toObject(),
          mySubmission: subMap[String(a._id)] || null,
        })),
        conversationId: conversation?._id,
        tutor: batch.tutor,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProgress = async (req, res) => {
  try {
    const enrollments = await getStudentEnrollments(req.user._id);
    const overall =
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce((s, e) => s + (e.progress?.overallPercent || 0), 0) /
              enrollments.length
          )
        : 0;

    res.json({
      success: true,
      data: {
        overallPercent: overall,
        courses: enrollments.map((e) => e.progress),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await StudentProfile.create({ user: req.user._id });
    }
    const user = await User.findById(req.user._id).select("name email phone avatar");
    res.json({ success: true, data: { user, profile } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const allowed = [
      "headline",
      "summary",
      "location",
      "github",
      "linkedin",
      "portfolio",
      "skills",
      "education",
      "experience",
    ];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    if (req.body.phone !== undefined) {
      await User.findByIdAndUpdate(req.user._id, { phone: req.body.phone });
    }
    if (req.body.name !== undefined) {
      await User.findByIdAndUpdate(req.user._id, { name: req.body.name });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true }
    );
    const user = await User.findById(req.user._id).select("name email phone avatar");
    res.json({ success: true, data: { user, profile } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getResumeData = async (req, res) => {
  try {
    const [profileDoc, enrollments, user] = await Promise.all([
      StudentProfile.findOne({ user: req.user._id }),
      getStudentEnrollments(req.user._id),
      User.findById(req.user._id).select("name email phone"),
    ]);

    const profile = profileDoc || { skills: [], education: [], experience: [] };
    const courseSkills = enrollments
      .map((e) => e.batch?.course?.category)
      .filter(Boolean);
    const progressSkills = enrollments.flatMap((e) => e.progress?.milestones || []);
    const allSkills = [
      ...new Set([...(profile.skills || []), ...courseSkills]),
    ];

    const learningSection = enrollments.map((e) => ({
      course: e.batch?.course?.title || e.batch?.workshop?.title,
      sourceType: e.batch?.sourceType || (e.batch?.workshop ? "workshop" : "course"),
      batch: e.batch?.name,
      progress: e.progress?.overallPercent,
      milestones: e.progress?.milestones,
    }));

    res.json({
      success: true,
      data: {
        user,
        profile: profile.toObject ? profile.toObject() : profile,
        skills: allSkills,
        learning: learningSection,
        achievements: progressSkills,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const seedDefaultJobs = async () => {
  const count = await JobListing.countDocuments();
  if (count > 0) return;
  await JobListing.insertMany([
    {
      title: "Junior Web Developer",
      company: "TechStart India",
      description: "Build responsive apps with React and Node. Great for bootcamp graduates.",
      location: "Bangalore / Remote",
      jobType: "full-time",
      skills: ["JavaScript", "React", "Node.js"],
      courseCategories: ["Web Development", "General"],
      applyLink: "https://example.com/apply",
    },
    {
      title: "Frontend Intern",
      company: "IndLearn Partners",
      description: "3-month internship with mentorship and live project work.",
      location: "Remote",
      jobType: "internship",
      skills: ["HTML", "CSS", "React"],
      courseCategories: ["Web Development"],
      applyLink: "https://example.com/intern",
    },
    {
      title: "Full Stack Engineer",
      company: "ScaleUp Labs",
      description: "Work on EdTech products — MongoDB, Express, React stack preferred.",
      location: "Hyderabad",
      jobType: "full-time",
      skills: ["MongoDB", "Express", "React"],
      courseCategories: ["Web Development", "Programming"],
      applyLink: "https://example.com/fullstack",
    },
  ]);
};

export const getCareerJobs = async (req, res) => {
  try {
    await seedDefaultJobs();
    const enrollments = await getStudentEnrollments(req.user._id);
    const categories = [
      ...new Set(
        enrollments.map((e) => e.batch?.course?.category).filter(Boolean)
      ),
    ];
    const skills = [
      ...new Set(
        enrollments.flatMap((e) => [
          e.batch?.course?.category,
          e.batch?.course?.level,
        ]).filter(Boolean)
      ),
    ];

    let jobs = await JobListing.find({ isActive: true }).sort({ createdAt: -1 });

    if (categories.length > 0) {
      const matched = jobs.filter(
        (j) =>
          !j.courseCategories?.length ||
          j.courseCategories.some((c) =>
            categories.some((cat) => cat.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(cat.toLowerCase()))
          )
      );
      jobs = matched.length ? matched : jobs;
    }

    const myApplications = await JobApplication.find({
      student: req.user._id,
      job: { $in: jobs.map((j) => j._id) },
    }).select("job status createdAt");

    const appByJob = Object.fromEntries(
      myApplications.map((a) => [String(a.job), { status: a.status, appliedAt: a.createdAt }])
    );

    const jobsWithApply = jobs.map((j) => ({
      ...j.toObject(),
      canApplyInApp: Boolean(j.companyRef),
      application: appByJob[String(j._id)] || null,
    }));

    res.json({
      success: true,
      data: {
        jobs: jobsWithApply,
        matchedSkills: skills,
        courseCategories: categories,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
