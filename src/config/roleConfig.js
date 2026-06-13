export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  TUTOR: "tutor",
  STUDENT: "student",
};

export const getSuperAdminEmail = () =>
  (process.env.SUPER_ADMIN_EMAIL || "official@indlearns.com")
    .toLowerCase()
    .trim();

export const isSuperAdminEmail = (email) =>
  email?.toLowerCase().trim() === getSuperAdminEmail();

export const isStaffDomainEmail = (email) => {
  if (!email) return false;
  return email.toLowerCase().trim().split("@")[1] === "indlearns.com";
};

export const isReservedEmail = (email) => isStaffDomainEmail(email);

export const canUseForgotPassword = (role) => role === ROLES.STUDENT;
