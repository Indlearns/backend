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
    /** Empty = all courses; otherwise only these course IDs */
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    /** Empty = no workshop restriction (unless other scopes set); specific workshop IDs */
    workshops: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workshop" }],
    /** Empty = no hackathon restriction; specific hackathon (Workshop) IDs */
    hackathons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workshop" }],
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
