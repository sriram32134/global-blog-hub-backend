import express from "express";
import { getCommentsByBlogId, postComment } from "../controllers/commentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// PUBLIC: Get all comments for a specific blog. (GET /api/comments/:blogId)
router.get("/:blogId", getCommentsByBlogId);

// PROTECTED: Post a new comment to a specific blog. (POST /api/comments/:blogId)
router.post("/:blogId", protect, postComment);

export default router;