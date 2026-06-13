import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * User roles:
 * - superadmin : official@indlearns.com — full control, resets staff passwords
 * - admin      : created by superadmin — no self password reset
 * - tutor      : created by superadmin — no self password reset
 * - student    : self-register — forgot password allowed
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "tutor", "student"],
      required: true,
    },
    avatar: { type: String, default: "" },
    phone: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    enrolledCourses: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    ],
    registeredWorkshops: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Workshop" },
    ],
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
