/** Registration open through end of registrationCloseDate (inclusive). */
export const isRegistrationClosed = (workshop) => {
  if (!workshop?.registrationCloseDate) return false;
  const end = new Date(workshop.registrationCloseDate);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
};

export const parseRegistrationCloseDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};
