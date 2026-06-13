import User from "../models/User.js";
import { generateSecurePassword } from "../utils/generatePassword.js";
import { ROLES, isStaffDomainEmail } from "../config/roleConfig.js";

const createStaff = async ({
  name,
  email,
  role,
  password,
  autoGeneratePassword,
  createdBy,
}) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.findOne({ email: normalizedEmail })) {
    throw new Error("A user with this email already exists.");
  }

  let plainPassword = password;
  let generated = false;
  if (autoGeneratePassword || !plainPassword) {
    plainPassword = generateSecurePassword(12);
    generated = true;
  }
  if (plainPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: plainPassword,
    role,
    createdBy,
  });

  return { user, plainPassword, generated };
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, autoGeneratePassword } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!isStaffDomainEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Admin emails must be @indlearns.com",
      });
    }

    const { user, plainPassword, generated } = await createStaff({
      name,
      email: normalizedEmail,
      role: ROLES.ADMIN,
      password,
      autoGeneratePassword,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: generated ? "Admin created. Copy password below." : "Admin created.",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(generated && { temporaryPassword: plainPassword }),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createTutor = async (req, res) => {
  try {
    const { name, email, password, autoGeneratePassword } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (isStaffDomainEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "@indlearns.com is for admins. Use Gmail/other for tutors.",
      });
    }

    const { user, plainPassword, generated } = await createStaff({
      name,
      email: normalizedEmail,
      role: ROLES.TUTOR,
      password,
      autoGeneratePassword,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: generated ? "Tutor created. Copy password below." : "Tutor created.",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(generated && { temporaryPassword: plainPassword }),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAdmins = async (req, res) => {
  const admins = await User.find({ role: ROLES.ADMIN }).select("-password").sort({ createdAt: -1 });
  res.json({ success: true, count: admins.length, data: admins });
};

export const getTutors = async (req, res) => {
  const tutors = await User.find({ role: ROLES.TUTOR }).select("-password").sort({ createdAt: -1 });
  res.json({ success: true, count: tutors.length, data: tutors });
};

/**
 * Reset password — SUPERADMIN ONLY (admins & tutors cannot self-reset)
 */
const roleFromParam = (param) =>
  param === "admins" ? ROLES.ADMIN : param === "tutors" ? ROLES.TUTOR : null;

export const resetStaffPassword = async (req, res) => {
  try {
    const role = roleFromParam(req.params.role);
    const { id } = req.params;

    if (!role) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    const staff = await User.findById(id);
    if (!staff || staff.role !== role) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (staff.role === ROLES.SUPERADMIN) {
      return res.status(403).json({
        success: false,
        message: "Cannot reset super admin password here. Use .env fix script.",
      });
    }

    const newPassword = generateSecurePassword(12);
    staff.password = newPassword;
    await staff.save();

    res.json({
      success: true,
      message: `New password for ${staff.email}`,
      data: { email: staff.email, temporaryPassword: newPassword },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleStaffActive = async (req, res) => {
  try {
    const role = roleFromParam(req.params.role);
    const { id } = req.params;
    const staff = await User.findById(id);

    if (!role || !staff || staff.role !== role) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (staff.role === ROLES.SUPERADMIN) {
      return res.status(403).json({ success: false, message: "Cannot deactivate super admin." });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.json({
      success: true,
      message: `Account ${staff.isActive ? "activated" : "deactivated"}.`,
      data: { _id: staff._id, isActive: staff.isActive },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
