import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import Company from "../models/Company.js";
import {
  buildPublicWorkshopFilter,
  buildAdminWorkshopTypeFilter,
  startOfToday,
} from "../utils/workshopVisibility.js";

export const getHome = async (req, res) => {
  try {
    const today = startOfToday();
    const upcomingFilter = {
      status: { $in: ["upcoming", "ongoing", "live"] },
      $or: [{ date: { $gte: today } }, { registrationCloseDate: { $gte: today } }],
    };
    const workshopFilter = { ...upcomingFilter, ...buildAdminWorkshopTypeFilter("workshop") };
    const hackathonFilter = { ...upcomingFilter, ...buildAdminWorkshopTypeFilter("hackathon") };

    const [courses, workshops, hackathons, courseCount, workshopCount, hackathonCount] =
      await Promise.all([
      Course.find({ status: "published" })
        .select("-createdBy")
        .sort({ createdAt: -1 })
        .limit(6),
      Workshop.find(workshopFilter)
        .select("-createdBy")
        .sort({ date: 1 })
        .limit(4),
      Workshop.find(hackathonFilter)
        .select("-createdBy")
        .sort({ date: 1 })
        .limit(4),
      Course.countDocuments({ status: "published" }),
      Workshop.countDocuments(workshopFilter),
      Workshop.countDocuments(hackathonFilter),
    ]);

    res.json({
      success: true,
      data: {
        courses,
        workshops,
        hackathons,
        counts: {
          courses: courseCount,
          workshops: workshopCount,
          hackathons: hackathonCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourses = async (req, res) => {
  try {
    const filter = { status: "published" };
    if (req.query.category) filter.category = req.query.category;

    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      status: "published",
    });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkshops = async (req, res) => {
  try {
    const filter = buildPublicWorkshopFilter(req.query.eventType);
    const workshops = await Workshop.find(filter).sort({ date: 1, startTime: 1 });
    res.json({ success: true, count: workshops.length, data: workshops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkshopById = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop || ["cancelled", "completed"].includes(workshop.status)) {
      return res.status(404).json({ success: false, message: "Workshop not found." });
    }
    res.json({ success: true, data: workshop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, count: companies.length, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
