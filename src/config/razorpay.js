import Razorpay from "razorpay";

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID?.trim() || "";

export const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET?.trim() || "";

export const isRazorpayConfigured = () =>
  Boolean(getRazorpayKeyId() && getRazorpayKeySecret());

export const getRazorpay = () => {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

