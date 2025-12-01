import User from '../models/User.js';
import Blog from '../models/Blog.js';
import Comment from '../models/Comment.js';
import mongoose from 'mongoose';

// Helper function to handle Mongoose find errors
const handleMongooseError = (res, err) => {
    console.error("Mongoose Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
}

// ----------------------------------------------------
// 1. GET ADMIN DASHBOARD COUNTS
export const getAdminDashboardCounts = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPosts = await Blog.countDocuments({ status: 'Published' });
        const totalReportedBlogs = await Blog.countDocuments({ isReported: true }); 

        res.json({
            success: true,
            counts: {
                totalUsers,
                totalPosts,
                totalReportedBlogs,
            }
        });
    } catch (err) {
        handleMongooseError(res, err);
    }
}


// ----------------------------------------------------
// 2. GET ALL USERS (Admin Only - Live Data)
export const getAllUsersAdmin = async (req, res) => {
    try {
        // CRITICAL FIX: Explicitly include the 'followers' array in the select fields
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('name email role profilePicture handle about createdAt followers') 
            .sort({ createdAt: -1 });

        const usersWithStats = await Promise.all(users.map(async (user) => {
            const posts = await Blog.countDocuments({ author: user._id });
            
            // Calculate follower count reliably from the fetched array
            const followerCount = (user.followers || []).length;
            
            return {
                ...user.toObject(),
                posts,
                // Return the correct count
                followerCount, 
            };
        }));
        
        res.json({ success: true, users: usersWithStats });
    } catch (err) {
        handleMongooseError(res, err);
    }
};
// ----------------------------------------------------
// 3. DELETE USER (Admin Only - Functionality for UserList)
export const deleteUserAdmin = async (req, res) => {
    try {
        const userIdToDelete = req.params.userId;
        
        if (userIdToDelete === req.user.id) {
            return res.status(403).json({ success: false, message: "Cannot delete your own admin account." });
        }

        // 1. Delete associated blogs and comments
        await Blog.deleteMany({ author: userIdToDelete });
        await Comment.deleteMany({ author: userIdToDelete });

        // 2. CRITICAL CASCADING UPDATE: Remove the deleted user from EVERYONE's lists
        
        // A) Remove the deleted user from all 'following' arrays (unfollow them)
        await User.updateMany(
            { following: userIdToDelete },
            { $pull: { following: userIdToDelete } }
        );
        // B) Remove the deleted user from all 'followers' arrays (remove them as a follower)
        await User.updateMany(
            { followers: userIdToDelete },
            { $pull: { followers: userIdToDelete } }
        );
        
        // C) Remove the deleted user from all blog likes/saves (cleanup interactions)
        await Blog.updateMany(
            { $or: [{ likes: userIdToDelete }, { savedBy: userIdToDelete }] },
            { $pull: { likes: userIdToDelete, savedBy: userIdToDelete } }
        );


        // 3. Finally, delete the user
        const result = await User.findByIdAndDelete(userIdToDelete);

        if (!result) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "User and all associated content deleted." });
    } catch (err) {
        handleMongooseError(res, err);
    }
};


// ----------------------------------------------------
// 4. GET REPORTED BLOGS (Admin Only - Live Data)
export const getReportedBlogs = async (req, res) => {
    try {
        // Fetch blogs that have been flagged as reported
        const reportedBlogs = await Blog.find({ isReported: true }) 
            .populate('author', 'name email')
            .select('title author status reportCount coverImage createdAt') // Add fields needed for list
            .sort({ reportCount: -1, createdAt: -1 });

        res.json({ success: true, blogs: reportedBlogs });
    } catch (err) {
        handleMongooseError(res, err);
    }
}