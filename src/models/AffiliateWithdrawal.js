import mongoose from "mongoose";

const affiliateWithdrawalSchema = new mongoose.Schema(
  {
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    bankAccountHolderName: { type: String, required: true },
    bankAccountNumber: { type: String, required: true },
    bankIfsc: { type: String, required: true },
    bankName: { type: String, required: true },
    affiliateName: { type: String, default: "" },
    affiliateEmail: { type: String, default: "" },
    affiliatePhone: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AffiliateWithdrawal", affiliateWithdrawalSchema);
