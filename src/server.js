import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { seedSuperAdmin } from "./scripts/seedAdmins.js";
import apiRoutes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { initSocket } from "./socket/index.js";
import { getRazorpayKeyId, isRazorpayConfigured } from "./config/razorpay.js";
import { getClientUrl, corsOptions, socketCorsOptions } from "./config/clientUrl.js";
import { isEmailConfigured } from "./utils/sendEmail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const clientUrl = getClientUrl();

const app = express();
const httpServer = createServer(app);

// Socket.IO - real-time communication (chat, live classes in later phases)
const io = new Server(httpServer, {
  cors: socketCorsOptions,
});

initSocket(io);

// Connect to MongoDB Atlas, then ensure super admin exists
connectDB()
  .then(() => seedSuperAdmin())
  .catch((err) => console.error("Startup error:", err.message));

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API routes - all routes start with /api
app.use("/api", apiRoutes);

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`IndLearn server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`CORS allowed frontend: ${clientUrl}`);
  const keyId = getRazorpayKeyId();
  if (isRazorpayConfigured()) {
    console.log(
      `Razorpay: ${keyId.startsWith("rzp_test_") ? "TEST mode" : "LIVE mode"} (${keyId.slice(0, 12)}...)`
    );
  } else {
    console.log("Razorpay: not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env");
  }
  console.log(
    isEmailConfigured()
      ? "Email (SMTP): configured — super admin OTP will be emailed"
      : "Email (SMTP): not configured — super admin OTP logged to console only"
  );
});

export { io };
