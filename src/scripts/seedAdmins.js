import User from "../models/User.js";
import { getSuperAdminEmail, ROLES } from "../config/roleConfig.js";

export const seedSuperAdmin = async () => {
  const email = getSuperAdminEmail();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!password || password.length < 6) {
    console.warn("⚠️  SUPER_ADMIN_PASSWORD missing — super admin not seeded.");
    return;
  }

  let user = await User.findOne({ email }).select("+password");

  if (!user) {
    await User.create({
      name: "Super Admin",
      email,
      password,
      role: ROLES.SUPERADMIN,
      isActive: true,
    });
    console.log(`✅ Super admin created: ${email}`);
    return;
  }

  let updated = false;
  if (user.role !== ROLES.SUPERADMIN) {
    console.log(`⚠️  Fixing ${email}: "${user.role}" → superadmin`);
    user.role = ROLES.SUPERADMIN;
    updated = true;
  }
  if (!user.isActive) {
    user.isActive = true;
    updated = true;
  }
  if (process.env.SUPER_ADMIN_RESET_PASSWORD === "true") {
    user.password = password;
    updated = true;
    console.log("🔑 Super admin password reset from .env");
  }

  if (updated) {
    await user.save();
    console.log(`✅ Super admin updated: ${email}`);
  } else {
    console.log(`✓  Super admin ready: ${email}`);
  }
};
