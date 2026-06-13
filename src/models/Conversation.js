import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["batch", "doubt", "student_peer", "group"],
      default: "batch",
    },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSchedule" },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    jitsiRoomName: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
