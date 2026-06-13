import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    headline: { type: String, default: "" },
    summary: { type: String, default: "" },
    location: { type: String, default: "" },
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    skills: [{ type: String, trim: true }],
    education: [
      {
        school: { type: String, default: "" },
        degree: { type: String, default: "" },
        year: { type: String, default: "" },
        description: { type: String, default: "" },
      },
    ],
    experience: [
      {
        company: { type: String, default: "" },
        role: { type: String, default: "" },
        start: { type: String, default: "" },
        end: { type: String, default: "" },
        description: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("StudentProfile", studentProfileSchema);
