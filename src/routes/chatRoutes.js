import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getConversations,
  getContacts,
  startDoubtChat,
  joinConversation,
  getMessages,
  sendMessage,
  getVideoConfig,
  getLiveClasses,
  getLiveClassVideo,
} from "../controllers/chatController.js";
import {
  getStaffDirectory,
  openBatchConversation,
  startGroupChat,
} from "../controllers/chatStaffController.js";
import { authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roleConfig.js";

const router = express.Router();

router.use(protect);

router.get("/conversations", getConversations);
router.get("/contacts", getContacts);

router.get(
  "/staff/directory",
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  getStaffDirectory
);
router.post(
  "/conversations/batch/:batchId",
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  openBatchConversation
);
router.post(
  "/conversations/group",
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  startGroupChat
);
router.post("/conversations/doubt", startDoubtChat);
router.post("/conversations/:id/join", joinConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", sendMessage);
router.get("/conversations/:id/video", getVideoConfig);

router.get("/live-classes", getLiveClasses);
router.get("/live-classes/:scheduleId/video", getLiveClassVideo);

export default router;
