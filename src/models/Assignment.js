import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    dueDate: { type: Date },
    maxScore: { type: Number, default: 100 },
    attachments: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Assignment", assignmentSchema);
