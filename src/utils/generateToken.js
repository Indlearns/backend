import jwt from "jsonwebtoken";

/**
 * Creates a signed JWT token for a user.
 * The token is sent to the frontend and stored (cookie or localStorage).
 */
export const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
