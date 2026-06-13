import User from "../../models/User.js";
import { ROLES, isStaffDomainEmail } from "../../config/roleConfig.js";
import { generateSecurePassword } from "../../utils/generatePassword.js";

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
        message: "@indlearns.com is for admins. Use personal email for tutors.",
      });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ success: false, message: "Email already exists." });
    }

    let plainPassword = password;
    let generated = false;
    if (autoGeneratePassword || !plainPassword) {
      plainPassword = generateSecurePassword(12);
      generated = true;
    }

    const tutor = await User.create({
      name,
      email: normalizedEmail,
      password: plainPassword,
      role: ROLES.TUTOR,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: generated ? "Tutor created. Copy password below." : "Tutor created.",
      data: {
        _id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        role: tutor.role,
        ...(generated && { temporaryPassword: plainPassword }),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getTutors = async (req, res) => {
  const tutors = await User.find({ role: ROLES.TUTOR })
    .select("-password")
    .sort({ createdAt: -1 });
  res.json({ success: true, count: tutors.length, data: tutors });
};
