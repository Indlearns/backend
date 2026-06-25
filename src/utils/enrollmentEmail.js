import User from "../models/User.js";
import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import { isEmailConfigured, sendEnrollmentSuccessEmail } from "./sendEmail.js";

const resolveItemDetails = async (purchaseType, itemId) => {
  if (purchaseType === "course") {
    const course = await Course.findById(itemId).select("title");
    return {
      itemType: "course",
      itemTitle: course?.title || "Course",
    };
  }

  const workshop = await Workshop.findById(itemId).select("title eventType");
  const itemType = workshop?.eventType === "hackathon" ? "hackathon" : "workshop";
  return {
    itemType,
    itemTitle: workshop?.title || (itemType === "hackathon" ? "Hackathon" : "Workshop"),
  };
};

/** Fire-and-forget enrollment confirmation email (does not throw). */
export const notifyEnrollmentSuccess = async ({
  studentId,
  purchaseType,
  itemId,
  amountPaid = 0,
}) => {
  if (!isEmailConfigured()) {
    console.log(
      `[enrollment email] SMTP not configured — skipped for student ${studentId}`
    );
    return;
  }

  try {
    const student = await User.findById(studentId).select("name email");
    if (!student?.email?.trim()) return;

    const { itemType, itemTitle } = await resolveItemDetails(purchaseType, itemId);

    await sendEnrollmentSuccessEmail({
      to: student.email,
      name: student.name,
      itemType,
      itemTitle,
      amountPaid,
    });
  } catch (error) {
    console.error("[enrollment email]", error.message);
  }
};
