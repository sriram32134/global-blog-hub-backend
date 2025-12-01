// server/models/Blog.js

import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Blog title is required'],
        trim: true,
        maxlength: 150
    },
    subtitle: {
        type: String,
        trim: true,
        maxlength: 300
    },
    content: {
        type: String,
        required: [true, 'Blog content is required']
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    coverImage: {
        type: String, 
        required: [true, 'A cover image is required']
    },
    category: {
        type: String,
        enum: ['Development', 'AI', 'Writing', 'Tech', 'Others', 'Finance', 'Travel', 'Health','social','news'], // ⭐ ADDED CATEGORIES
        default: 'Development'
    },
    status: {
        type: String,
        enum: ['Draft', 'Published'],
        default: 'Published' 
    },
    likes: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    savedBy: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    commentCount: {
        type: Number,
        default: 0
    },
    // ⭐ ADDED: Fields for Reporting/Moderation
    isReported: {
        type: Boolean,
        default: false,
    },
    // Simple placeholder for report count (optional)
    reportCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Blog = mongoose.model('Blog', BlogSchema);

export default Blog;