import Company from "../models/Company.js";
import { getStudentEnrollments } from "./studentProgress.js";
import StudentProfile from "../models/StudentProfile.js";

export const getPartnerCompany = async (userId) => {
  const company = await Company.findOne({ partnerUser: userId, isActive: true });
  if (!company) {
    const err = new Error("No company linked to this partner account.");
    err.status = 403;
    throw err;
  }
  return company;
};

export const buildStudentProgressPayload = async (studentId) => {
  const [enrollments, profile] = await Promise.all([
    getStudentEnrollments(studentId),
    StudentProfile.findOne({ user: studentId }),
  ]);

  return {
    enrollments: enrollments.map((e) => ({
      batchName: e.batch?.name,
      courseTitle: e.batch?.course?.title || e.batch?.workshop?.title,
      courseCategory: e.batch?.course?.category || e.batch?.workshop?.eventType,
      sourceType: e.batch?.sourceType || (e.batch?.workshop ? "workshop" : "course"),
      overallPercent: e.progress?.overallPercent ?? 0,
      assignmentPct: e.progress?.assignmentPct ?? 0,
      classPct: e.progress?.classPct ?? 0,
      averageScore: e.progress?.stats?.averageScore,
      milestones: e.progress?.milestones ?? [],
    })),
    profile: profile
      ? {
          headline: profile.headline,
          skills: profile.skills,
          education: profile.education,
          experience: profile.experience,
        }
      : null,
  };
};
