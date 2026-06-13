import mongoose from "mongoose";

/**
 * Password reset tokens — STUDENTS ONLY
 * Staff (admin, tutor, superadmin) cannot use forgot password.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);
export default PasswordResetToken;
