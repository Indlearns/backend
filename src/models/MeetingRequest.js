import mongoose from "mongoose";

const meetingRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["doubt", "meeting"],
      default: "doubt",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "completed"],
      default: "pending",
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSchedule" },
    preferredAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    respondedAt: { type: Date },
    responseNote: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("MeetingRequest", meetingRequestSchema);
