// server/controllers/commentController.js

import Comment from "../models/Comment.js";
import Blog from "../models/Blog.js";
import mongoose from "mongoose";

// Helper function (imported from blogController for consistency)
const handleMongooseError = (res, err) => {
    console.error("Mongoose Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
}

// ----------------------------------------------------
// 1. GET COMMENTS BY BLOG ID (Public - FIX: Ensure proper return and population)
export const getCommentsByBlogId = async (req, res) => {
    try {
        const { blogId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID" });
        }

        const comments = await Comment.find({ blog: blogId, isApproved: true })
            // ⭐ FIX: Explicitly populate 'name' and 'handle' (as used by the frontend)
            .populate('author', 'name handle profilePicture') 
            .sort({ createdAt: 1 }); 

        res.status(200).json({ success: true, comments: comments || [] });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 2. POST NEW COMMENT (Protected - FIX: Ensure content is a string)
export const postComment = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID" });
        }

        // ⭐ CRITICAL FIX: Explicitly check if 'content' is a string before trimming
        if (typeof content !== 'string' || content.trim() === '') {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        // 1. Create the new comment document
        const newComment = await Comment.create({
            blog: blogId,
            author: userId,
            content,
        });

        // 2. Increment comment count on the Blog model (optional but good practice)
        await Blog.findByIdAndUpdate(blogId, { $inc: { commentCount: 1 } });
        
        // 3. Populate author data for immediate display on client
        // Ensure we populate the same fields as the public GET route expects
        await newComment.populate('author', 'name handle profilePicture'); 

        res.status(201).json({ success: true, comment: newComment });

    } catch (error) {
        handleMongooseError(res, error);
    }
};