import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getHome = async (req, res) => {
  try {
    const today = startOfToday();
    const [courses, workshops, courseCount, workshopCount] = await Promise.all([
      Course.find({ status: "published" })
        .select("-createdBy")
        .sort({ createdAt: -1 })
        .limit(6),
      Workshop.find({
        status: { $in: ["upcoming", "ongoing"] },
        date: { $gte: today },
      })
        .select("-createdBy")
        .sort({ date: 1 })
        .limit(4),
      Course.countDocuments({ status: "published" }),
      Workshop.countDocuments({
        status: { $in: ["upcoming", "ongoing"] },
        date: { $gte: today },
      }),
    ]);

    res.json({
      success: true,
      data: {
        courses,
        workshops,
        counts: {
          courses: courseCount,
          workshops: workshopCount,
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
    const today = startOfToday();
    const filter = {
      status: { $in: ["upcoming", "ongoing"] },
      date: { $gte: today },
    };
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
