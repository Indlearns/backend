import Course from "../../models/Course.js";
import CoursePurchase from "../../models/CoursePurchase.js";
import { getCourseImageUrl } from "../../middleware/uploadMiddleware.js";
import { parseEnrollmentCloseDate } from "../../utils/courseEnrollment.js";
import {
  groupByMonth,
  formatEnrollmentRow,
  enrollmentsToCsv,
} from "../../utils/enrollmentReport.js";



const parseCourseBody = (body) => {

  const price = Number(body.price) || 0;

  return {

    title: body.title,

    description: body.description || "",

    category: body.category || "General",

    duration: body.duration || "",

    enrollmentCloseDate: parseEnrollmentCloseDate(body.enrollmentCloseDate),

    status: body.status || "draft",

    price,

    currency: body.currency || "INR",

    isFree: price <= 0,

  };

};



export const createCourse = async (req, res) => {

  try {

    const data = parseCourseBody(req.body);

    if (!data.title) {

      return res.status(400).json({ success: false, message: "Course title is required." });

    }

    if (req.file) {

      data.thumbnail = getCourseImageUrl(req.file.filename);

    }

    const course = await Course.create({ ...data, createdBy: req.user._id });

    res.status(201).json({ success: true, data: course });

  } catch (error) {

    res.status(400).json({ success: false, message: error.message });

  }

};



export const getCourses = async (req, res) => {

  const courses = await Course.find()

    .populate("createdBy", "name email")

    .sort({ createdAt: -1 });

  res.json({ success: true, count: courses.length, data: courses });

};



export const updateCourse = async (req, res) => {

  try {

    const course = await Course.findById(req.params.id);

    if (!course) {

      return res.status(404).json({ success: false, message: "Course not found." });

    }



    if (req.body.title !== undefined) course.title = req.body.title;

    if (req.body.description !== undefined) course.description = req.body.description;

    if (req.body.category !== undefined) course.category = req.body.category;

    if (req.body.duration !== undefined) course.duration = req.body.duration;

    if (req.body.enrollmentCloseDate !== undefined) {

      course.enrollmentCloseDate = parseEnrollmentCloseDate(req.body.enrollmentCloseDate);

    }

    if (req.body.status !== undefined) course.status = req.body.status;

    if (req.body.price !== undefined) {

      course.price = Number(req.body.price) || 0;

      course.isFree = course.price <= 0;

    }

    if (req.file) {

      course.thumbnail = getCourseImageUrl(req.file.filename);

    }



    await course.save();

    res.json({ success: true, data: course });

  } catch (error) {

    res.status(400).json({ success: false, message: error.message });

  }

};



export const deleteCourse = async (req, res) => {

  const course = await Course.findByIdAndDelete(req.params.id);

  if (!course) return res.status(404).json({ success: false, message: "Course not found." });

  res.json({ success: true, message: "Course deleted." });

};

export const getCourseEnrollments = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const purchases = await CoursePurchase.find({
      course: course._id,
      status: "paid",
    })
      .populate("student", "name email phone isActive")
      .sort({ createdAt: -1 });

    const enrollments = purchases
      .filter((p) => p.student)
      .map((p) => formatEnrollmentRow(p, course));

    res.json({
      success: true,
      data: {
        course: {
          _id: course._id,
          title: course.title,
          price: course.price,
          currency: course.currency,
          category: course.category,
        },
        totalEnrollments: enrollments.length,
        totalRevenue: enrollments.reduce((s, e) => s + (e.amount || 0), 0),
        byMonth: groupByMonth(enrollments),
        enrollments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportCourseEnrollments = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const purchases = await CoursePurchase.find({
      course: course._id,
      status: "paid",
    })
      .populate("student", "name email phone")
      .sort({ createdAt: -1 });

    const enrollments = purchases
      .filter((p) => p.student)
      .map((p) => formatEnrollmentRow(p, course));

    const csv = enrollmentsToCsv(enrollments);
    const safeTitle = course.title.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
    const filename = `${safeTitle}_enrollments_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

