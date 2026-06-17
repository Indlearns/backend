import { ROLES } from "../config/roleConfig.js";

/** Payments are only for student accounts (courses, workshops, hackathons). */
export const requireStudentForPayment = (req, res, next) => {
  if (req.user?.role !== ROLES.STUDENT) {
    return res.status(403).json({
      success: false,
      code: "STUDENT_ROLE_REQUIRED",
      message:
        "Please log in with a student account to purchase or register. Admin, tutor, and partner accounts cannot checkout.",
    });
  }
  next();
};
