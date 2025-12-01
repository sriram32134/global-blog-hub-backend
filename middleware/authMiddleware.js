import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // FIX: Attach user to request
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Token failed, not valid" });
  }
};
// New Middleware: Checks if the request is coming from an Admin
export const admin = (req, res, next) => {
    // Relies on 'protect' having populated req.user
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        // 403 Forbidden
        res.status(403).json({ message: 'Not authorized as an administrator' });
    }
}