import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** What this batch is tied to: course, workshop, or hackathon */
    sourceType: {
      type: String,
      enum: ["course", "workshop", "hackathon"],
      default: "course",
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    /** Used for both workshop and hackathon (same Workshop collection) */
    workshop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workshop",
      default: null,
    },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
    },
    maxStudents: { type: Number, default: 50 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

batchSchema.pre("validate", function (next) {
  const type = this.sourceType || "course";
  if (type === "course") {
    if (!this.course) {
      this.invalidate("course", "Course is required for a course batch.");
    }
  } else if (!this.workshop) {
    this.invalidate("workshop", "Workshop/hackathon is required for this batch.");
  }
  next();
});

export default mongoose.model("Batch", batchSchema);
