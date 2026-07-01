import mongoose from "mongoose";

const classRecordingSchema = new mongoose.Schema(
  {
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSchedule",
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    classDate: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    filePath: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: "video/webm" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

classRecordingSchema.index({ batch: 1, createdAt: -1 });
classRecordingSchema.index({ schedule: 1 });

export default mongoose.model("ClassRecording", classRecordingSchema);
