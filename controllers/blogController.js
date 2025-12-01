import Blog from "../models/Blog.js";
import User from "../models/User.js"; 
import Comment from "../models/Comment.js"; 
import imagekit from "../config/imagekit.js";
import mongoose from "mongoose";
// ⭐ FIX: Correcting the named import for the latest SDK
import { GoogleGenAI } from '@google/genai'; 

// Initialize Gemini client (assuming API key is in environment variables)
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY); // ⭐ Using the corrected class name
const aiModel = "gemini-2.5-flash";

// Fields to select when populating the Author for lists/details
const authorSelectFields = 'name handle profilePicture followers';

// Helper function to handle Mongoose find errors
const handleMongooseError = (res, err) => {
    console.error("Mongoose Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
}

// ----------------------------------------------------
// ⭐ NEW: AI CONTENT GENERATION (Protected)
export const generateAIContent = async (req, res) => {
    try {
        const { title, subtitle, category } = req.body;
        
        if (!title || !subtitle) {
            return res.status(400).json({ success: false, message: "Title and subtitle are required for AI generation." });
        }
        
        const systemInstruction = `You are a professional blog writer. Your task is to write a well-structured, engaging blog post suitable for a general audience. The output MUST be formatted using HTML tags (e.g., <h2>, <p>, <ul>, <strong>) for direct insertion into a rich text editor. Do NOT use markdown syntax. The tone should be informative and engaging.`;

        const userPrompt = `Write a comprehensive blog post based on the following details:
        1. Main Topic/Title: "${title}"
        2. Subtitle/Hook: "${subtitle}"
        3. Primary Category/Focus: "${category}"
        
        Ensure the post has an introduction, 2-3 detailed body sections, and a conclusion. Use proper HTML formatting (<h2>, <p>, <strong>, etc.).`;

        const response = await ai.models.generateContent({
            model: aiModel,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            },
        });

        const generatedContent = response.text;
        
        if (!generatedContent) {
            return res.status(500).json({ success: false, message: "AI failed to generate content. Try again." });
        }

        res.json({ success: true, content: generatedContent });

    } catch (err) {
        console.error("Gemini API Error:", err);
        // Check if error is related to API key or resource limits
        if (err.message.includes('API_KEY_INVALID')) {
            return res.status(500).json({ success: false, message: "Gemini API Key is invalid or missing. Check server configuration." });
        }
        res.status(500).json({ success: false, message: "Server error during AI generation." });
    }
};


// ----------------------------------------------------
// 1. CREATE BLOG (Protected)
export const createBlog = async (req, res) => {
    try {
        const { title, content, subtitle, category, coverImageBase64, fileName } = req.body;
        
        if (!title || !content || !coverImageBase64) {
            return res.status(400).json({ success: false, message: "Title, content, and cover image are required." });
        }
        
        let coverImageUrl = "";

        if (coverImageBase64) {
            const imageKitResponse = await imagekit.upload({
                file: coverImageBase64,
                fileName: fileName || `${req.user.id}_${Date.now()}_blog_cover.jpg`,
                folder: "/blog_covers",
            });
            coverImageUrl = imageKitResponse.url;
        }

        const newBlog = await Blog.create({
            title,
            content,
            subtitle,
            category,
            coverImage: coverImageUrl,
            author: req.user.id,
        });

        res.status(201).json({ success: true, blog: newBlog });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || "Failed to create blog" });
    }
};

// ----------------------------------------------------
// 2. GET ALL BLOGS (Public - Used for HomePage)
export const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find({ status: 'Published' }) 
          .populate("author", authorSelectFields) 
          .select("-content")
          .sort({ createdAt: -1 });

        res.json({ success: true, blogs: blogs || [] });
    } catch (err) {
        handleMongooseError(res, err);
    }
};

// ----------------------------------------------------
// 3. GET BLOG BY ID (Public)
export const getBlogById = async (req, res) => {
    try {
        // 1. Fetch the Blog (with detailed author info, including FOLLOWERS for client-side status check)
        const blog = await Blog.findById(req.params.id)
            .populate({ path: 'author', select: authorSelectFields + ' email followers' }); 
        
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }

        // 2. Manually fetch comments associated with this blog ID
        const comments = await Comment.find({ blog: req.params.id, isApproved: true })
            .populate('author', authorSelectFields)
            .sort({ createdAt: -1 });

        // 3. Create a temporary object to merge blog data and comments
        const blogWithComments = {
            ...blog.toObject(),
            comments: comments || []
        };

        res.status(200).json({ success: true, blog: blogWithComments }); 

    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid blog ID format' });
        }
        console.error("Error fetching blog by ID:", error);
        res.status(500).json({ success: false, message: 'Server error fetching blog details' });
    }
};

// ----------------------------------------------------
// 4. UPDATE BLOG (Protected, Author only)
export const updateBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);

        if (!blog)
          return res.status(404).json({ success: false, message: "Blog not found" });

        if (blog.author.toString() !== req.user.id)
          return res.status(403).json({ success: false, message: "You cannot edit this blog" });

        let updateFields = req.body;
        
        if (req.body.coverImageBase64) {
            const imageKitResponse = await imagekit.upload({
                file: req.body.coverImageBase64,
                fileName: req.body.fileName || `${req.user.id}_${Date.now()}_blog_cover.jpg`,
                folder: "/blog_covers", 
            });
            updateFields.coverImage = imageKitResponse.url;
            delete updateFields.coverImageBase64;
        }

        const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updateFields, { new: true });

        res.json({ success: true, blog: updatedBlog });
    } catch (err) {
        handleMongooseError(res, err);
    }
};

// ----------------------------------------------------
// 5. DELETE BLOG (Protected, Author only)
export const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);

        if (!blog)
          return res.status(404).json({ success: false, message: "Blog not found" });

        if (blog.author.toString() !== req.user.id)
          return res.status(403).json({ success: false, message: "You cannot delete this blog" });

        await blog.deleteOne();

        res.json({ success: true, message: "Blog deleted successfully" });
    } catch (err) {
        handleMongooseError(res, err);
    }
};

// ----------------------------------------------------
// 6. DASHBOARD COUNTS (Protected)
export const getUserDashboardCounts = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.json({ success: true, counts: { totalBlogs: 0, totalDrafts: 0, totalSaved: 0 } });
        }
        
        const totalBlogs = await Blog.countDocuments({ author: userId });
        const totalDrafts = await Blog.countDocuments({ author: userId, status: 'Draft' });
        const totalSavedBlogs = await Blog.countDocuments({ savedBy: userId }); 
        
        res.json({ 
            success: true, 
            counts: {
                totalBlogs: totalBlogs,
                totalDrafts: totalDrafts,
                totalSaved: totalSavedBlogs,
            }
        });
    } catch (err) {
        handleMongooseError(res, err);
    }
}

// ----------------------------------------------------
// 7. GET AUTH USER BLOGS (Protected)
export const getAuthUserBlogs = async (req, res) => {
    try {
        const userId = req.user.id; 

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }

        const blogs = await Blog.find({ author: userId })
            .populate('author', authorSelectFields)
            .select('-content') 
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, blogs: blogs || [] });

    } catch (error) {
        console.error("Error fetching user's blogs:", error);
        res.status(500).json({ success: false, message: 'Server error fetching user blogs' });
    }
};

// ----------------------------------------------------
// 8. GET POPULAR USER BLOGS (Protected)
export const getPopularUserBlogs = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }
        
        const popularBlogs = await Blog.aggregate([
            { $match: { author: new mongoose.Types.ObjectId(userId), status: 'Published' } },
            { $addFields: { likeCount: { $size: "$likes" } } },
            { $sort: { likeCount: -1, createdAt: -1 } }, 
            { $limit: 10 }, 
            { $project: { title: 1, _id: 1, likeCount: 1, commentCount: 1, author: 1 } } 
        ]);
        
        await Blog.populate(popularBlogs, { path: 'author', select: authorSelectFields }); 

        res.status(200).json({ success: true, blogs: popularBlogs || [] }); 

    } catch (error) {
        console.error("Error fetching popular user blogs:", error);
        res.status(500).json({ success: false, message: 'Server error fetching popular blogs' });
    }
};

// ----------------------------------------------------
// 9. GET SAVED USER BLOGS (Protected)
export const getSavedUserBlogs = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }

        const savedBlogs = await Blog.find({ savedBy: userId })
            .populate('author', authorSelectFields)
            .select("-content") 
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, blogs: savedBlogs || [] }); 

    } catch (error) {
        console.error("Error fetching saved blogs:", error);
        res.status(500).json({ success: false, message: 'Server error fetching saved blogs' });
    }
}


// ----------------------------------------------------
// 10. TOGGLE LIKE (Protected)
export const toggleLike = async (req, res) => { 
    try {
        const blogId = req.params.id;
        const userId = req.user.id;

        const blog = await Blog.findById(blogId);

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        const alreadyLiked = blog.likes.includes(userId);

        const update = alreadyLiked
            ? { $pull: { likes: userId } } 
            : { $push: { likes: userId } }; 

        const updatedBlog = await Blog.findByIdAndUpdate(blogId, update, { new: true });
        
        res.json({ 
            success: true, 
            liked: !alreadyLiked, 
            likesCount: updatedBlog.likes.length,
            message: alreadyLiked ? "Unliked" : "Liked"
        });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 11. TOGGLE SAVE (Protected)
export const toggleSave = async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;

        const blog = await Blog.findById(blogId);

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        const alreadySaved = blog.savedBy.includes(userId);

        const update = alreadySaved
            ? { $pull: { savedBy: userId } } 
            : { $push: { savedBy: userId } }; 

        const updatedBlog = await Blog.findByIdAndUpdate(blogId, update, { new: true });
        
        res.json({ 
            success: true, 
            saved: !alreadySaved, 
            message: alreadySaved ? "Unsaved" : "Saved"
        });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// NEW: GET TOP LIKED BLOGS (For Admin Dashboard Home)
export const getTopLikedBlogsAdmin = async (req, res) => {
    try {
        const topBlogs = await Blog.aggregate([
            { $match: { status: 'Published' } }, 
            { $addFields: { likeCount: { $size: "$likes" } } },
            { $sort: { likeCount: -1, createdAt: -1 } }, 
            { $limit: 5 }, 
            { $project: { title: 1, author: 1, likeCount: 1, commentCount: 1 } } 
        ]);

        await Blog.populate(topBlogs, { path: 'author', select: authorSelectFields }); 

        res.status(200).json({ success: true, blogs: topBlogs || [] }); 
    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// NEW: GET ALL POSTS (Admin Only - Functionality for PostManagement)
export const getAllPostsAdmin = async (req, res) => {
    try {
        const posts = await Blog.find()
            .populate("author", authorSelectFields + ' email')
            .select("-content") 
            .sort({ createdAt: -1 });

        res.json({ success: true, posts: posts || [] }); 
    } catch (err) {
        handleMongooseError(res, err);
    }
};

// ----------------------------------------------------
// NEW: ADMIN DELETE POST (Admin Only - Functionality for PostManagement/ReportedBlogs)
export const deletePostAdmin = async (req, res) => {
    try {
        const blogId = req.params.id;
        
        const result = await Blog.findByIdAndDelete(blogId);

        if (!result)
          return res.status(404).json({ success: false, message: "Blog not found" });

        await Comment.deleteMany({ blog: blogId }); 

        res.json({ success: true, message: "Blog permanently deleted by admin" });
    } catch (err) {
        handleMongooseError(res, err);
    }
};


// ----------------------------------------------------
// NEW: REPORT BLOG (Protected - Functionality for BlogDetail)
export const reportBlog = async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }
        
        if (blog.author.toString() === userId) {
             return res.status(400).json({ message: "You cannot report your own post." });
        }
        
        const updatedBlog = await Blog.findByIdAndUpdate(
            blogId,
            { 
                $set: { isReported: true },
                $inc: { reportCount: 1 } 
            }, 
            { new: true }
        );

        res.json({ 
            success: true, 
            message: "Post reported successfully. An administrator will review it." 
        });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

export const dismissReport = async (req, res) => {
    try {
        const blogId = req.params.id;

        const updatedBlog = await Blog.findByIdAndUpdate(
            blogId,
            { 
                $set: { isReported: false, reportCount: 0 }, 
            }, 
            { new: true }
        );

        if (!updatedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        res.json({ success: true, message: "Report dismissed, blog removed from queue." });
    } catch (error) {
        handleMongooseError(res, error);
    }
};

export const getPopularBlogs = async (req, res) => {
    try {
        const { category } = req.query; 
        
        let matchStage = { status: 'Published' }; 
        
        if (category && category !== 'all') {
            matchStage.category = category; 
        }
        
        const popularBlogs = await Blog.aggregate([
            { $match: matchStage }, 
            { $addFields: { likeCount: { $size: "$likes" } } },
            { $sort: { likeCount: -1, createdAt: -1 } }, 
            { $limit: 20 },
            { $project: { title: 1, author: 1, likeCount: 1, commentCount: 1, coverImage: 1, subtitle: 1, category: 1, createdAt: 1 } }
        ]);

        await Blog.populate(popularBlogs, { path: 'author', select: authorSelectFields }); 

        res.status(200).json({ success: true, blogs: popularBlogs || [] });
    } catch (error) {
        handleMongooseError(res, error); 
    }
};

export const getBlogsByCategory = async (req, res) => {
    try {
        const { category } = req.query; 
        
        let filter = { status: 'Published' }; 
        
        if (category && category !== 'all') {
            filter.category = category;
        }

        const blogs = await Blog.find(filter) 
          .populate("author", authorSelectFields)
          .select("-content")
          .sort({ createdAt: -1 }); 

        res.json({ success: true, blogs: blogs || [] });
    } catch (err) {
        handleMongooseError(res, err);
    }
};

export const getBlogsByAuthorId = async (req, res) => {
    try {
        const authorId = req.params.authorId;

        if (!mongoose.Types.ObjectId.isValid(authorId)) {
            return res.status(400).json({ success: false, message: 'Invalid author ID format.' });
        }

        const blogs = await Blog.find({ author: authorId, status: 'Published' }) 
            .populate("author", authorSelectFields)
            .select("-content")
            .sort({ createdAt: -1 });

        res.json({ success: true, blogs: blogs || [] });
    } catch (err) {
        handleMongooseError(res, err);
    }
};

// ⭐ NEW: GET FOLLOWING FEED (Protected)
export const getFollowingFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. Get the list of IDs the current user is following
        const currentUser = await User.findById(userId).select('following');
        const followingIds = currentUser.following;

        if (followingIds.length === 0) {
            return res.json({ success: true, blogs: [], message: "You are not following any authors." });
        }

        // 2. Fetch published blogs only from those authors, newest first
        const blogs = await Blog.find({ 
            author: { $in: followingIds },
            status: 'Published'
        })
          .populate("author", authorSelectFields)
          .select("-content")
          .sort({ createdAt: -1 })
          .limit(50); // Limit the feed size

        res.json({ success: true, blogs: blogs || [] });
    } catch (err) {
        handleMongooseError(res, err);
    }
};