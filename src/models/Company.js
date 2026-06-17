import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    logo: { type: String, default: "" },
    website: { type: String, default: "" },
    description: { type: String, default: "" },
    partnershipType: {
      type: String,
      enum: ["hiring", "sponsor", "curriculum", "other"],
      default: "hiring",
    },
    partnerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);
