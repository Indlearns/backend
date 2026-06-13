import mongoose from "mongoose";

const workshopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    /** workshop = standard session, hackathon = competitive event */
    eventType: {
      type: String,
      enum: ["workshop", "hackathon"],
      default: "workshop",
    },
    date: { type: Date, required: true },
    startTime: { type: String, default: "10:00" },
    endTime: { type: String, default: "12:00" },
    meetLink: { type: String, default: "" },
    maxParticipants: { type: Number, default: 100 },
    /** Price in INR. 0 = free registration */
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
    isFree: { type: Boolean, default: false },
    /** Last day to register (inclusive) */
    registrationCloseDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workshopSchema.pre("save", function (next) {
  if (this.price <= 0) this.isFree = true;
  else this.isFree = false;
  next();
});

export default mongoose.model("Workshop", workshopSchema);
