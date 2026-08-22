import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const affiliateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, default: "", trim: true },
    kycType: { type: String, enum: ["aadhar", "pan", ""], default: "" },
    aadharNumber: { type: String, default: "", trim: true },
    panNumber: { type: String, default: "", trim: true },
    bankAccountHolderName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    bankIfsc: { type: String, default: "", trim: true, uppercase: true },
    bankName: { type: String, default: "", trim: true },
    affiliateCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    availableBalance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    lastWithdrawalRequestAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

affiliateSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

affiliateSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

affiliateSchema.methods.isProfileComplete = function () {
  const hasKyc =
    this.kycType === "aadhar"
      ? /^\d{12}$/.test(this.aadharNumber)
      : this.kycType === "pan"
        ? /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(this.panNumber)
        : false;

  return Boolean(
    this.name?.trim() &&
      this.phone?.trim() &&
      this.email?.trim() &&
      hasKyc &&
      this.bankAccountHolderName?.trim() &&
      this.bankAccountNumber?.trim() &&
      this.bankIfsc?.trim() &&
      this.bankName?.trim()
  );
};

export const generateAffiliateCode = () => {
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `IL-${suffix}`;
};

const Affiliate = mongoose.model("Affiliate", affiliateSchema);
export default Affiliate;
