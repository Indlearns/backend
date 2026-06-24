import mongoose from "mongoose";

const referralCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    isActive: { type: Boolean, default: true },
    maxUses: { type: Number, default: null, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

referralCodeSchema.pre("save", function (next) {
  if (this.code) this.code = this.code.trim().toUpperCase();
  next();
});

export default mongoose.model("ReferralCode", referralCodeSchema);
