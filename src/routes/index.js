import express from "express";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import superadminRoutes from "./superadminRoutes.js";
import chatRoutes from "./chatRoutes.js";
import tutorRoutes from "./tutorRoutes.js";
import studentRoutes from "./studentRoutes.js";
import publicRoutes from "./publicRoutes.js";
import paymentRoutes from "./paymentRoutes.js";

const router = express.Router();

// Health check - confirms API is running
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "IndLearn API is running",
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/payments", paymentRoutes);
router.use("/superadmin", superadminRoutes);
router.use("/admin", adminRoutes);
router.use("/chat", chatRoutes);
router.use("/tutor", tutorRoutes);
router.use("/student", studentRoutes);

// Phase 2+ routes will be added here:
// router.use("/courses", courseRoutes);
// router.use("/batches", batchRoutes);
// router.use("/workshops", workshopRoutes);

export default router;
