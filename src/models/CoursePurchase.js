import mongoose from "mongoose";

const coursePurchaseSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    paymentGateway: { type: String, default: "paypal" },
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

coursePurchaseSchema.index({ student: 1, course: 1 }, { unique: true });
coursePurchaseSchema.index({ paymentOrderId: 1 });

export default mongoose.model("CoursePurchase", coursePurchaseSchema);
