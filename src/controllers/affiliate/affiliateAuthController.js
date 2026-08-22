import Affiliate, { generateAffiliateCode } from "../../models/Affiliate.js";
import { generateToken } from "../../utils/generateToken.js";
import { isReservedEmail } from "../../config/roleConfig.js";

const AFFILIATE_ROLE = "affiliate";

const formatAffiliateResponse = (affiliate, token) => ({
  _id: affiliate._id,
  name: affiliate.name,
  email: affiliate.email,
  phone: affiliate.phone,
  role: AFFILIATE_ROLE,
  affiliateCode: affiliate.affiliateCode,
  kycType: affiliate.kycType,
  aadharNumber: affiliate.aadharNumber ? "****" + affiliate.aadharNumber.slice(-4) : "",
  panNumber: affiliate.panNumber ? affiliate.panNumber.slice(0, 2) + "****" + affiliate.panNumber.slice(-2) : "",
  bankAccountHolderName: affiliate.bankAccountHolderName,
  bankAccountNumber: affiliate.bankAccountNumber
    ? "****" + affiliate.bankAccountNumber.slice(-4)
    : "",
  bankIfsc: affiliate.bankIfsc,
  bankName: affiliate.bankName,
  availableBalance: affiliate.availableBalance,
  totalEarned: affiliate.totalEarned,
  totalWithdrawn: affiliate.totalWithdrawn,
  profileComplete: affiliate.isProfileComplete(),
  token,
});

export const registerAffiliate = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
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
        message: "@indlearns.com is reserved for staff. Use a personal email.",
      });
    }

    if (await Affiliate.findOne({ email: normalizedEmail })) {
      return res.status(400).json({
        success: false,
        message: "An affiliate account with this email already exists. Please log in.",
      });
    }

    let affiliateCode = generateAffiliateCode();
    for (let i = 0; i < 5; i += 1) {
      const exists = await Affiliate.exists({ affiliateCode });
      if (!exists) break;
      affiliateCode = generateAffiliateCode();
    }

    const affiliate = await Affiliate.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || "",
      affiliateCode,
    });

    const token = generateToken(affiliate._id, AFFILIATE_ROLE);
    res.status(201).json({
      success: true,
      message: "Affiliate account created. Complete your profile to get your links.",
      data: formatAffiliateResponse(affiliate, token),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginAffiliate = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const affiliate = await Affiliate.findOne({ email: normalizedEmail }).select("+password");
    if (!affiliate || !(await affiliate.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!affiliate.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account deactivated. Contact support.",
      });
    }

    const token = generateToken(affiliate._id, AFFILIATE_ROLE);
    res.json({
      success: true,
      message: "Login successful.",
      data: formatAffiliateResponse(affiliate, token),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAffiliateMe = async (req, res) => {
  res.json({
    success: true,
    data: formatAffiliateResponse(req.user, undefined),
  });
};

export const updateAffiliateProfile = async (req, res) => {
  try {
    const affiliate = await Affiliate.findById(req.user._id);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: "Affiliate not found." });
    }

    const {
      name,
      phone,
      kycType,
      aadharNumber,
      panNumber,
      bankAccountHolderName,
      bankAccountNumber,
      bankIfsc,
      bankName,
    } = req.body;

    if (name !== undefined) affiliate.name = name.trim();
    if (phone !== undefined) affiliate.phone = phone.trim();

    if (kycType !== undefined) {
      if (!["aadhar", "pan", ""].includes(kycType)) {
        return res.status(400).json({ success: false, message: "Invalid KYC type." });
      }
      affiliate.kycType = kycType;
    }

    if (aadharNumber !== undefined) {
      affiliate.aadharNumber = aadharNumber.replace(/\D/g, "");
    }
    if (panNumber !== undefined) {
      affiliate.panNumber = panNumber.toUpperCase().replace(/\s/g, "");
    }
    if (bankAccountHolderName !== undefined) {
      affiliate.bankAccountHolderName = bankAccountHolderName.trim();
    }
    if (bankAccountNumber !== undefined) {
      affiliate.bankAccountNumber = bankAccountNumber.replace(/\s/g, "");
    }
    if (bankIfsc !== undefined) {
      affiliate.bankIfsc = bankIfsc.toUpperCase().replace(/\s/g, "");
    }
    if (bankName !== undefined) affiliate.bankName = bankName.trim();

    if (affiliate.kycType === "aadhar" && affiliate.aadharNumber && !/^\d{12}$/.test(affiliate.aadharNumber)) {
      return res.status(400).json({ success: false, message: "Aadhar must be 12 digits." });
    }
    if (affiliate.kycType === "pan" && affiliate.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(affiliate.panNumber)) {
      return res.status(400).json({ success: false, message: "Invalid PAN format." });
    }

    await affiliate.save();
    res.json({
      success: true,
      message: "Profile updated.",
      data: formatAffiliateResponse(affiliate, undefined),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Full profile for affiliate's own view (includes masked KYC) */
export const getAffiliateProfileDetails = async (req, res) => {
  const affiliate = await Affiliate.findById(req.user._id).select("-password");
  if (!affiliate) {
    return res.status(404).json({ success: false, message: "Affiliate not found." });
  }

  res.json({
    success: true,
    data: {
      ...affiliate.toObject(),
      role: AFFILIATE_ROLE,
      profileComplete: affiliate.isProfileComplete(),
    },
  });
};
