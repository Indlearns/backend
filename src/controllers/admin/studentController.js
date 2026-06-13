import User from "../../models/User.js";
import Batch from "../../models/Batch.js";
import Course from "../../models/Course.js";
import CoursePurchase from "../../models/CoursePurchase.js";
import WorkshopPurchase from "../../models/WorkshopPurchase.js";
import { ROLES } from "../../config/roleConfig.js";
import {
  groupByMonth,
  formatEnrollmentRow,
  enrollmentsToCsv,
} from "../../utils/enrollmentReport.js";
export const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: ROLES.STUDENT })
      .select("-password")
      .sort({ createdAt: -1 });

    const studentIds = students.map((s) => s._id);
    const batches = await Batch.find({ students: { $in: studentIds } }).select(
      "name students course"
    );

    const batchCountByStudent = {};
    for (const batch of batches) {
      for (const sid of batch.students || []) {
        const key = String(sid);
        batchCountByStudent[key] = (batchCountByStudent[key] || 0) + 1;
      }
    }

    const data = students.map((s) => ({
      ...s.toObject(),
      batchCount: batchCountByStudent[String(s._id)] || 0,
      enrolledCourseCount: s.enrolledCourses?.length || 0,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: ROLES.STUDENT,
    })
      .select("-password")
      .populate("enrolledCourses", "title price category duration status")
      .populate("registeredWorkshops", "title price eventType date status");

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const [batches, coursePurchases, workshopPurchases] = await Promise.all([
      Batch.find({ students: student._id })
        .populate("course", "title category")
        .populate("tutor", "name email")
        .sort({ updatedAt: -1 }),
      CoursePurchase.find({ student: student._id, status: "paid" })
        .populate("course", "title price category")
        .sort({ createdAt: -1 }),
      WorkshopPurchase.find({ student: student._id, status: "paid" })
        .populate("workshop", "title price eventType date")
        .sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      data: {
        student,
        batches,
        coursePurchases,
        workshopPurchases,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Course-wise enrollment summary for admin students page */
export const getEnrollmentsByCourse = async (req, res) => {
  try {
    const courses = await Course.find().sort({ title: 1 });
    const purchases = await CoursePurchase.find({ status: "paid" })
      .populate("student", "name email phone")
      .populate("course", "title price currency category")
      .sort({ createdAt: -1 });

    const byCourse = courses.map((course) => {
      const coursePurchases = purchases.filter(
        (p) => String(p.course?._id || p.course) === String(course._id) && p.student
      );
      const enrollments = coursePurchases.map((p) => formatEnrollmentRow(p, course));
      return {
        course: {
          _id: course._id,
          title: course.title,
          price: course.price,
          currency: course.currency,
          category: course.category,
          status: course.status,
        },
        totalEnrollments: enrollments.length,
        totalRevenue: enrollments.reduce((s, e) => s + (e.amount || 0), 0),
        byMonth: groupByMonth(enrollments),
        enrollments,
      };
    });

    const withEnrollments = byCourse.filter((c) => c.totalEnrollments > 0);
    const allEnrollments = purchases
      .filter((p) => p.student && p.course)
      .map((p) => formatEnrollmentRow(p, p.course));

    res.json({
      success: true,
      data: {
        courses: byCourse,
        coursesWithEnrollments: withEnrollments.length,
        totalEnrollments: allEnrollments.length,
        allByMonth: groupByMonth(allEnrollments),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportAllEnrollments = async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = { status: "paid" };
    if (courseId) filter.course = courseId;

    const purchases = await CoursePurchase.find(filter)
      .populate("student", "name email phone")
      .populate("course", "title price currency")
      .sort({ createdAt: -1 });

    const enrollments = purchases
      .filter((p) => p.student && p.course)
      .map((p) => formatEnrollmentRow(p, p.course));

    const csv = enrollmentsToCsv(enrollments);
    const filename = courseId
      ? `course_enrollments_${new Date().toISOString().slice(0, 10)}.csv`
      : `all_enrollments_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
