import express from "express";
import {
  registerAffiliate,
  loginAffiliate,
  getAffiliateMe,
  updateAffiliateProfile,
  getAffiliateProfileDetails,
} from "../controllers/affiliate/affiliateAuthController.js";
import {
  getAffiliateDashboard,
  getAffiliateProducts,
  getAffiliateSales,
  getAffiliateWithdrawals,
  requestAffiliateWithdrawal,
} from "../controllers/affiliate/affiliateDashboardController.js";
import { affiliateAuth } from "../middleware/authMiddleware.js";
import { COMMISSION_TIERS, AFFILIATE_MIN_WITHDRAWAL } from "../utils/affiliateCommission.js";

const router = express.Router();

router.get("/program-info", (_req, res) => {
  res.json({
    success: true,
    data: {
      commissionTiers: COMMISSION_TIERS,
      minWithdrawal: AFFILIATE_MIN_WITHDRAWAL,
      withdrawalProcessingDays: "3–4 working days",
    },
  });
});

router.post("/register", registerAffiliate);
router.post("/login", loginAffiliate);

router.use(affiliateAuth);
router.get("/me", getAffiliateMe);
router.get("/profile", getAffiliateProfileDetails);
router.put("/profile", updateAffiliateProfile);
router.get("/dashboard", getAffiliateDashboard);
router.get("/products", getAffiliateProducts);
router.get("/sales", getAffiliateSales);
router.get("/withdrawals", getAffiliateWithdrawals);
router.post("/withdrawals", requestAffiliateWithdrawal);

export default router;
