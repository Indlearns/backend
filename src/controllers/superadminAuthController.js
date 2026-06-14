import crypto from "crypto";
import User from "../models/User.js";
import SuperAdminLoginCode from "../models/SuperAdminLoginCode.js";
import { generateToken } from "../utils/generateToken.js";
import { getSuperAdminEmail, isSuperAdminEmail, ROLES } from "../config/roleConfig.js";
import {
  isEmailConfigured,
  sendSuperAdminLoginCode,
} from "../utils/sendEmail.js";
import { seedSuperAdmin } from "../scripts/seedAdmins.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code).trim()).digest("hex");

const generateCode = () => String(crypto.randomInt(100000, 999999));

const formatUserResponse = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  token,
});

/** POST /auth/superadmin/request-code */
export const requestSuperAdminCode = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.toLowerCase().trim();
    const superEmail = getSuperAdminEmail();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    if (!isSuperAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: `Only ${superEmail} can use super admin login.`,
      });
    }

    await seedSuperAdmin();

    const user = await User.findOne({ email: superEmail, role: ROLES.SUPERADMIN });
    if (!user || !user.isActive) {
      return res.status(503).json({
        success: false,
        message: "Super admin account is not ready. Check SUPER_ADMIN_PASSWORD on the server.",
      });
    }

    const code = generateCode();
    const codeHash = hashCode(code);

    await SuperAdminLoginCode.deleteMany({ email: superEmail, used: false });
    await SuperAdminLoginCode.create({
      email: superEmail,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    const devFallback = !isEmailConfigured();

    if (devFallback) {
      console.log(`[superadmin OTP] ${superEmail} → ${code} (SMTP not configured)`);
    } else {
      await sendSuperAdminLoginCode(superEmail, code);
    }

    res.json({
      success: true,
      message: devFallback
        ? "Login code generated (email not configured — see server logs or response in dev)."
        : `Login code sent to ${superEmail}. Check your inbox.`,
      ...(devFallback && {
        devCode: code,
        note: "Configure SMTP on Render for production email delivery.",
      }),
    });
  } catch (error) {
    console.error("requestSuperAdminCode:", error.message);
    res.status(500).json({
      success: false,
      message: error.message.includes("Email is not configured")
        ? "Email service not configured on server. Add SMTP settings to Render."
        : "Could not send login code. Try again.",
    });
  }
};

/** POST /auth/superadmin/verify-code */
export const verifySuperAdminCode = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.toLowerCase().trim();
    const code = String(req.body.code || "").trim();
    const superEmail = getSuperAdminEmail();

    if (!normalizedEmail || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and login code are required.",
      });
    }

    if (!isSuperAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: `Only ${superEmail} can use super admin login.`,
      });
    }

    const record = await SuperAdminLoginCode.findOne({
      email: superEmail,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Code expired or not found. Request a new code.",
      });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: "Too many attempts. Request a new code.",
      });
    }

    if (record.codeHash !== hashCode(code)) {
      record.attempts += 1;
      await record.save();
      return res.status(401).json({
        success: false,
        message: "Invalid code. Check the email and try again.",
      });
    }

    const user = await User.findOne({ email: superEmail, role: ROLES.SUPERADMIN });
    if (!user || !user.isActive) {
      return res.status(503).json({
        success: false,
        message: "Super admin account is not available.",
      });
    }

    record.used = true;
    await record.save();

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
