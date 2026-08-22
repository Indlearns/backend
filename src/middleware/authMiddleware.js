import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Affiliate from "../models/Affiliate.js";

const AFFILIATE_ROLE = "affiliate";

/**
 * Protect routes - user or affiliate must be logged in with valid JWT
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please log in.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === AFFILIATE_ROLE) {
      req.user = await Affiliate.findById(decoded.id).select("-password");
      if (req.user) req.user.role = AFFILIATE_ROLE;
    } else {
      req.user = await User.findById(decoded.id).select("-password");
    }

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account deactivated.",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Token invalid or expired.",
    });
  }
};

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not allowed to access this resource.`,
      });
    }
    next();
  };

export const affiliateAuth = [protect, authorize(AFFILIATE_ROLE)];
