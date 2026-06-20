import mongoose from "mongoose";

const workshopPurchaseSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workshop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    paymentGateway: { type: String, default: "zoho" },
    paymentOrderId: { type: String, default: "" },
    paymentTransactionId: { type: String, default: "" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
  },
  { timestamps: true }
);

workshopPurchaseSchema.index({ student: 1, workshop: 1 }, { unique: true });
workshopPurchaseSchema.index({ paymentOrderId: 1 });

export default mongoose.model("WorkshopPurchase", workshopPurchaseSchema);
