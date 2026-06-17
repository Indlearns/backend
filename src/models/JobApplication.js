import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobListing", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["applied", "reviewing", "shortlisted", "rejected", "hired"],
      default: "applied",
    },
    coverNote: { type: String, default: "" },
    progressSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ job: 1, student: 1 }, { unique: true });
jobApplicationSchema.index({ company: 1, createdAt: -1 });

export default mongoose.model("JobApplication", jobApplicationSchema);
