import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createPayPalOrder, getPayPalAccessToken } from "../src/utils/paypalClient.js";
import { getPayPalClientId, isPayPalConfigured } from "../src/config/paypal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

if (!isPayPalConfigured()) {
  console.error("Missing PayPal credentials in backend/.env");
  process.exit(1);
}

try {
  await getPayPalAccessToken();
  const order = await createPayPalOrder({
    amount: 1,
    currency: "USD",
    description: "INDLearns PayPal test",
    customId: "test-order",
  });
  console.log("PayPal configuration OK");
  console.log("Test order:", order.id);
  console.log("Client ID:", getPayPalClientId().slice(0, 12) + "...");
} catch (error) {
  console.error("PayPal error:", error.message);
  process.exit(1);
}
