import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log("KEY_ID present:", Boolean(keyId));
console.log("KEY_SECRET present:", Boolean(keySecret));
console.log("Test mode:", Boolean(keyId?.startsWith("rzp_test_")));

if (!keyId || !keySecret) {
  console.error("Missing Razorpay keys in backend/.env");
  process.exit(1);
}

const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

try {
  const order = await rzp.orders.create({
    amount: 10000,
    currency: "INR",
    receipt: `test_${Date.now()}`,
  });
  console.log("Order created:", order.id);
  console.log("Razorpay configuration OK");
} catch (e) {
  console.error("Razorpay error:", e.error?.description || e.message);
  process.exit(1);
}
