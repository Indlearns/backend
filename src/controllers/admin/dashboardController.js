import Course from "../../models/Course.js";
import Workshop from "../../models/Workshop.js";
import Batch from "../../models/Batch.js";
import Company from "../../models/Company.js";
import User from "../../models/User.js";
import ClassSchedule from "../../models/ClassSchedule.js";
import { ROLES } from "../../config/roleConfig.js";

export const getDashboard = async (req, res) => {
  try {
    const [courses, workshops, batches, companies, tutors, students, upcomingClasses] =
      await Promise.all([
        Course.countDocuments(),
        Workshop.countDocuments(),
        Batch.countDocuments(),
        Company.countDocuments({ isActive: true }),
        User.countDocuments({ role: ROLES.TUTOR, isActive: true }),
        User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
        ClassSchedule.countDocuments({
          date: { $gte: new Date() },
          status: "scheduled",
        }),
      ]);

    res.json({
      success: true,
      data: {
        user: req.user,
        stats: {
          courses,
          workshops,
          batches,
          companies,
          tutors,
          students,
          upcomingClasses,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
