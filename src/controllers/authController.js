import crypto from "crypto";
import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { generateToken } from "../utils/generateToken.js";
import {
  ROLES,
  isReservedEmail,
  canUseForgotPassword,
} from "../config/roleConfig.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    if (isReservedEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: "@indlearns.com is for staff only. Use a personal email.",
      });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({
        success: false,
        message: "Account exists. Please login.",
      });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: ROLES.STUDENT,
    });

    const token = generateToken(user._id, user.role);
    res.status(201).json({
      success: true,
      message: "Student account created.",
      data: formatUserResponse(user, token),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: getLoginHint(expectedRole),
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account deactivated. Contact support.",
      });
    }

    if (user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: getWrongPortalMessage(user.role, expectedRole),
      });
    }

    const token = generateToken(user._id, user.role);
    res.json({
      success: true,
      message: "Login successful.",
      data: formatUserResponse(user, token),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Forgot password — STUDENTS ONLY
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !canUseForgotPassword(user.role)) {
      return res.json({
        success: true,
        message:
          "If a student account exists, a reset link has been sent. (Staff must contact super admin.)",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");

    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({
      user: user._id,
      token: hashed,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: "Password reset link generated.",
      ...(process.env.NODE_ENV === "development" && {
        resetUrl,
        note: "In development the link is shown here. In production, send via email.",
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Valid token and password (min 6 chars) required.",
      });
    }

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const resetRecord = await PasswordResetToken.findOne({
      token: hashed,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    const user = await User.findById(resetRecord.user).select("+password");
    if (!user || !canUseForgotPassword(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Password reset is only for student accounts.",
      });
    }

    user.password = password;
    await user.save();
    resetRecord.used = true;
    await resetRecord.save();

    res.json({
      success: true,
      message: "Password reset successful. You can login now.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const formatUserResponse = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  token,
});

const getLoginHint = (expectedRole) => {
  const hints = {
    [ROLES.STUDENT]: "Invalid credentials. Register first if you are new.",
    [ROLES.TUTOR]: "Invalid credentials. Ask super admin for your tutor login.",
    [ROLES.ADMIN]: "Invalid credentials. Use /admins/login with admin account.",
    [ROLES.SUPERADMIN]: "Invalid credentials. Use /superadmin/login only.",
  };
  return hints[expectedRole] || "Invalid email or password.";
};

const getWrongPortalMessage = (actual, expected) => {
  const portals = {
    [ROLES.SUPERADMIN]: "/superadmin/login",
    [ROLES.ADMIN]: "/admins/login",
    [ROLES.TUTOR]: "/login (Tutor tab)",
    [ROLES.STUDENT]: "/login (Student tab)",
  };
  return `This account is "${actual}". Please use ${portals[actual] || "the correct login page"}.`;
};
