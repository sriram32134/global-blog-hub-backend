import express from "express";
import {
    createBlog,
    getAllBlogs,
    getBlogById,
    updateBlog,
    deleteBlog,
    getUserDashboardCounts, 
    toggleLike, 
    toggleSave,
    getAuthUserBlogs, 
    getPopularUserBlogs,
    getSavedUserBlogs, 
    getTopLikedBlogsAdmin,
    getAllPostsAdmin,
    deletePostAdmin,
    reportBlog,
    dismissReport,
    getPopularBlogs,
    getBlogsByCategory,
    getBlogsByAuthorId,
    getFollowingFeed, 
    generateAIContent // ⭐ NEW IMPORT
} from "../controllers/blogController.js";

import { protect, admin } from "../middleware/authMiddleware.js";
import { toggleFollow } from "../controllers/userController.js"; 

const router = express.Router();

// ------------------------------------------------------------------
// 1. SPECIFIC PROTECTED ROUTES (USER DASHBOARD)
router.get("/dashboard/counts", protect, getUserDashboardCounts);
router.get("/user", protect, getAuthUserBlogs);
router.get("/user/popular", protect, getPopularUserBlogs);
router.get("/user/saved", protect, getSavedUserBlogs); 
router.get("/user/feed", protect, getFollowingFeed);

// ⭐ NEW ROUTE: AI Content Generation (Protected)
router.post("/generate-ai-content", protect, generateAIContent); 
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 2. ADMIN-SPECIFIC ROUTES
router.get("/admin/all-posts", protect, admin, getAllPostsAdmin); 
router.get("/admin/top-liked", protect, admin, getTopLikedBlogsAdmin); 
router.delete("/admin/posts/:id", protect, admin, deletePostAdmin); 
router.post("/admin/reports/:id/dismiss", protect, admin, dismissReport);
// ------------------------------------------------------------------


// PUBLIC ROUTES:
router.get("/", getAllBlogs);
router.get("/popular", getPopularBlogs);
router.get("/category", getBlogsByCategory);
router.get("/author/:authorId", getBlogsByAuthorId);

// PROTECTED CRUD ROUTES: 
router.post("/", protect, createBlog); 
router.put("/:id", protect, updateBlog); 
router.delete("/:id", protect, deleteBlog); 


// INTERACTION ROUTES (Protected)
router.post("/like/:id", protect, toggleLike); 
router.post("/save/:id", protect, toggleSave); 
router.post("/report/:id", protect, reportBlog); 
router.post("/follow/:userId", protect, toggleFollow); 

// PARAMETERIZED ROUTES (Must be LAST)
router.get("/:id", getBlogById);

export default router;