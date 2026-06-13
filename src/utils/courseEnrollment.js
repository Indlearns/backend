/** Enrollment open through end of enrollmentCloseDate (local calendar day). */
export const isEnrollmentClosed = (course) => {
  if (!course?.enrollmentCloseDate) return false;
  const end = new Date(course.enrollmentCloseDate);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
};

export const parseEnrollmentCloseDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};
