import mongoose from "mongoose";

const classScheduleSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    meetLink: { type: String, default: "" },
    videoRoomId: { type: String, default: "" },
    jitsiRoomName: { type: String, default: "" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("ClassSchedule", classScheduleSchema);
