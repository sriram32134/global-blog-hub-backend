// server/routes/userRoutes.js (COMPLETE CODE TO REPLACE)

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { 
    updateProfile, 
    changePassword, 
    updateProfilePicture,
    getUserProfileById,
    getFollowingList, // ⭐ NEW
    getFollowersList,
    requestPasswordReset,
    resetPasswordFinal
} from "../controllers/userController.js";

const router = express.Router();

// ----------------------------------------------------
// 1. PUBLIC/GENERAL ROUTES (Accessible without JWT)
// ----------------------------------------------------

// Route to view a user's profile details by ID (Public)
router.get("/profile/:userId", getUserProfileById); 

// ----------------------------------------------------
// 2. PROTECTED ROUTES (User Dashboard - require JWT)
// ----------------------------------------------------

// Note: We now apply 'protect' individually to ensure the public route above is skipped.
// If you have many protected routes, you can still use router.use, but define a new router instance.
// For simplicity, let's apply 'protect' manually here:

// 1. Update general details (Name, Handle, About)
router.patch("/profile", protect, updateProfile);

// 2. Update profile picture
router.patch("/picture", protect, updateProfilePicture);

// 3. Change password
router.patch("/password", protect, changePassword);
router.post("/password-reset-request", requestPasswordReset);
router.post("/reset-password", resetPasswordFinal);

router.get("/following", protect, getFollowingList); // ⭐ NEW ROUTE
router.get("/followers", protect, getFollowersList);

export default router;