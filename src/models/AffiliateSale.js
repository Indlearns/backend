import mongoose from "mongoose";

const affiliateSaleSchema = new mongoose.Schema(
  {
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true,
    },
    purchaseType: {
      type: String,
      enum: ["course", "workshop", "hackathon"],
      required: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productTitle: { type: String, required: true },
    productPrice: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    commissionAmount: { type: Number, required: true },
    buyerName: { type: String, default: "" },
    buyerEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

affiliateSaleSchema.index({ purchaseType: 1, purchaseId: 1 }, { unique: true });

export default mongoose.model("AffiliateSale", affiliateSaleSchema);
