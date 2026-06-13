import { protect, authorize } from "./authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";

/** Admin + Superadmin (shared staff portal) */
export const staffAuth = [protect, authorize(ROLES.SUPERADMIN, ROLES.ADMIN)];

/** Superadmin only — manage other admins */
export const superAdminAuth = [protect, authorize(ROLES.SUPERADMIN)];
