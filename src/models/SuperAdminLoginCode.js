import mongoose from "mongoose";

/** One-time login code for super admin email OTP flow */
const superAdminLoginCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

superAdminLoginCodeSchema.index({ email: 1, used: 1 });
superAdminLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SuperAdminLoginCode", superAdminLoginCodeSchema);
