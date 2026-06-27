import mongoose from "mongoose";

/** Manually curated tutor showcase — not linked to tutor accounts. */
const tutorShowcaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

tutorShowcaseSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.model("TutorShowcase", tutorShowcaseSchema);
