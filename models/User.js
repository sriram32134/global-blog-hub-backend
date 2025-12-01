// server/models/User.js (COMPLETE CODE TO REPLACE)

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
      type: String,
      enum: ['user', 'admin'], 
      default: 'user' 
    },
    profilePicture: {
        type: String, 
        default: 'https://placehold.co/100x100/94A3B8/FFFFFF?text=P',
    },
    handle: {
        type: String,
        unique: true,
        sparse: true, 
        trim: true,
        minlength: 3,
    },
    about: {
        type: String,
        maxlength: 500,
        default: 'Welcome to my corner of the blogosphere.',
    },
    // ⭐ NEW: Arrays to track relationships
    followers: [{ // Users who follow this user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    following: [{ // Users this user follows
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);