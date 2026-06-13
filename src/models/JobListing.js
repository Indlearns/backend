import mongoose from "mongoose";

const jobListingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    location: { type: String, default: "Remote" },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "internship", "contract"],
      default: "full-time",
    },
    skills: [{ type: String, trim: true }],
    courseCategories: [{ type: String, trim: true }],
    applyLink: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("JobListing", jobListingSchema);
