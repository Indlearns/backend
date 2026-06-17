import User from "../../models/User.js";
import Company from "../../models/Company.js";
import JobListing from "../../models/JobListing.js";
import JobApplication from "../../models/JobApplication.js";
import { ROLES } from "../../config/roleConfig.js";
import { generateSecurePassword } from "../../utils/generatePassword.js";
import { getPartnerCompany, buildStudentProgressPayload } from "../../utils/partnerHelpers.js";

export const createPartnerCompany = async (req, res) => {
  try {
    const {
      companyName,
      email,
      password,
      autoGeneratePassword,
      website,
      description,
      partnershipType,
    } = req.body;

    if (!companyName?.trim() || !email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name and official email are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ success: false, message: "Email already in use." });
    }

    if (await Company.findOne({ contactEmail: normalizedEmail })) {
      return res.status(400).json({
        success: false,
        message: "A partner company with this email already exists.",
      });
    }

    let plainPassword = password;
    let generated = false;
    if (autoGeneratePassword || !plainPassword) {
      plainPassword = generateSecurePassword(12);
      generated = true;
    }

    if (plainPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const partnerUser = await User.create({
      name: companyName.trim(),
      email: normalizedEmail,
      password: plainPassword,
      role: ROLES.PARTNER,
      createdBy: req.user._id,
    });

    const company = await Company.create({
      name: companyName.trim(),
      contactEmail: normalizedEmail,
      website: website || "",
      description: description || "",
      partnershipType: partnershipType || "hiring",
      partnerUser: partnerUser._id,
      createdBy: req.user._id,
    });

    partnerUser.company = company._id;
    await partnerUser.save();

    const populated = await Company.findById(company._id).populate(
      "partnerUser",
      "name email isActive"
    );

    res.status(201).json({
      success: true,
      message: generated
        ? "Partner company created. Share login credentials with the company."
        : "Partner company created.",
      data: {
        company: populated,
        loginUrl: "/partners/login",
        ...(generated && { temporaryPassword: plainPassword }),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCompanies = async (req, res) => {
  const companies = await Company.find()
    .populate("partnerUser", "name email isActive")
    .sort({ createdAt: -1 });
  res.json({ success: true, count: companies.length, data: companies });
};

export const updateCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    const { name, website, description, partnershipType, isActive } = req.body;
    if (name !== undefined) company.name = name;
    if (website !== undefined) company.website = website;
    if (description !== undefined) company.description = description;
    if (partnershipType !== undefined) company.partnershipType = partnershipType;
    if (isActive !== undefined) company.isActive = isActive;

    await company.save();

    if (company.partnerUser && isActive !== undefined) {
      await User.findByIdAndUpdate(company.partnerUser, { isActive });
    }

    const populated = await Company.findById(company._id).populate(
      "partnerUser",
      "name email isActive"
    );
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    const jobs = await JobListing.find({ companyRef: company._id }).distinct("_id");
    if (jobs.length) {
      await JobApplication.deleteMany({ job: { $in: jobs } });
      await JobListing.deleteMany({ companyRef: company._id });
    }

    if (company.partnerUser) {
      await User.findByIdAndDelete(company.partnerUser);
    }

    await Company.findByIdAndDelete(company._id);
    res.json({ success: true, message: "Partner company and login removed." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** Legacy — prefer createPartnerCompany */
export const createCompany = createPartnerCompany;
