// server/routes/adminRoutes.js

import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import { 
    getAllUsersAdmin, 
    deleteUserAdmin,
    getReportedBlogs,
    getAdminDashboardCounts
} from "../controllers/adminController.js";
// Note: Admin login is handled via /api/auth/login

const router = express.Router();

// All these routes require protection AND admin role
router.use(protect, admin); 

// 1. Admin Overview Data
router.get("/dashboard/counts", getAdminDashboardCounts); // /api/admin/dashboard/counts

// 2. User Management
router.get("/users", getAllUsersAdmin); // /api/admin/users
router.delete("/users/:userId", deleteUserAdmin); // /api/admin/users/:userId

// 3. Content Reporting/Moderation
router.get("/reports", getReportedBlogs); // /api/admin/reports

export default router;