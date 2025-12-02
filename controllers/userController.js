import User from "../models/User.js";
import Blog from "../models/Blog.js"; // ADDED Blog model for post count
import bcrypt from "bcryptjs";
import imagekit from "../config/imagekit.js"; 
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import crypto from "crypto";

const handleMongooseError = (res, err) => {
    console.error("Mongoose Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
}

// ----------------------------------------------------
// 1. UPDATE PROFILE DETAILS (Name, Handle, About/Bio)
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, handle, about } = req.body;

        const updateFields = { name, handle, about };

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Return token and new user data for context update
        res.json({ success: true, message: "Profile updated successfully.", user: updatedUser });

    } catch (error) {
        if (error.code === 11000) { 
            return res.status(400).json({ success: false, message: "That handle is already taken." });
        }
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 2. CHANGE PASSWORD
export const changePassword = async (req, res) => {
    // ... (existing logic remains the same)
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ success: true, message: "Password updated successfully." });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 3. UPDATE PROFILE PICTURE
export const updateProfilePicture = async (req, res) => {
    // ... (existing logic remains the same, assuming JWT is refreshed separately)
    try {
        const userId = req.user.id;
        const { coverImageBase64, fileName } = req.body;

        if (!coverImageBase64) {
            return res.status(400).json({ success: false, message: "Profile image data is required." });
        }

        const imageKitResponse = await imagekit.upload({
            file: coverImageBase64,
            fileName: fileName || `${userId}_profile_${Date.now()}.jpg`,
            folder: "/user_profiles",
        });
        const profileImageUrl = imageKitResponse.url;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { profilePicture: profileImageUrl } },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
        // Return token and new user data for context update
        res.json({ success: true, message: "Profile picture updated.", user: updatedUser });
        
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to upload or update profile picture." });
    }
};

// ----------------------------------------------------
// 4. GET USER PROFILE BY ID (Public/Protected - for Modals)
export const getUserProfileById = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
             return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }

        // ⭐ FIX: Select the followers array to determine follow status on the client
        const user = await User.findById(userId).select('name handle about profilePicture followers');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const postsCount = await Blog.countDocuments({ author: userId, status: 'Published' });
        
        res.json({ 
            success: true, 
            profile: {
                id: user._id,
                name: user.name,
                handle: user.handle,
                about: user.about,
                profilePicture: user.profilePicture,
                postsCount: postsCount,
                // Return the length for the stat, and the full array for follow check (Point 1)
                followersCount: user.followers.length,
                followers: user.followers, 
            }
        });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 5. GET FOLLOWING LIST (Protected)
export const getFollowingList = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
                             .populate('following', 'name handle profilePicture');
        
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Point 3: Showing his followers (in the 'following' list) is confusing. 
        // This endpoint should show people HE follows. The other shows his followers.
        res.json({ following: user.following || [] });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// 6. GET FOLLOWERS LIST (Protected)
export const getFollowersList = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
                             .populate('followers', 'name handle profilePicture');

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        // Point 2: This should fix the issue of showing the followers list.
        res.json({ followers: user.followers || [] });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

// ----------------------------------------------------
// ⭐ 7. TOGGLE FOLLOW STATUS
export const toggleFollow = async (req, res) => {
    try {
        const userIdToFollow = req.params.userId;
        const currentUserId = req.user.id;

        if (userIdToFollow === currentUserId.toString()) {
            return res.status(400).json({ success: false, message: "You cannot follow yourself." });
        }

        const userToFollow = await User.findById(userIdToFollow);
        const currentUser = await User.findById(currentUserId);

        if (!userToFollow || !currentUser) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const isFollowing = currentUser.following.includes(userIdToFollow);

        let actionMessage;
        let newFollowingStatus;

        if (isFollowing) {
            // Unfollow: Pull from current user's 'following' and target user's 'followers'
            await User.findByIdAndUpdate(currentUserId, { $pull: { following: userIdToFollow } });
            await User.findByIdAndUpdate(userIdToFollow, { $pull: { followers: currentUserId } });
            actionMessage = `Unfollowed ${userToFollow.name}.`;
            newFollowingStatus = false;
        } else {
            // Follow: Push to current user's 'following' and target user's 'followers'
            await User.findByIdAndUpdate(currentUserId, { $push: { following: userIdToFollow } });
            await User.findByIdAndUpdate(userIdToFollow, { $push: { followers: currentUserId } });
            actionMessage = `Following ${userToFollow.name}!`;
            newFollowingStatus = true;
        }

        res.json({ 
            success: true, 
            following: newFollowingStatus, // Return the final status
            message: actionMessage
        });

    } catch (error) {
        handleMongooseError(res, error);
    }
};

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // Explicit Gmail host
    port: 465, // Standard secure port
    secure: true, // Use SSL/TLS
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, 
    },
});
const sendMail = async (to, subject, html) => {
    const mailOptions = {
        from: process.env.SMTP_USER,
        to,
        subject,
        html,
    };
    await transporter.sendMail(mailOptions);
};

export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: "Email is required." });
    }

    try {
        // 1. Find the user
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ 
                success: true, 
                message: "If an account exists, a recovery link has been sent." 
            });
        }

        // 2. Generate token
        const token = crypto.randomBytes(32).toString('hex');

        // 3. Save token to DB (IMPORTANT!)
        await User.findByIdAndUpdate(user._id, {
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000, // 1 hour
        });

        // 4. Build reset link
        const FRONTEND_DOMAIN = "https://global-blog-hub-frontend-git-master-srirams-projects-eb1c82e6.vercel.app/";
        const resetLink = `${FRONTEND_DOMAIN}/reset-password?token=${token}&email=${email}`;

        // 5. Email content
        const mailContent = `
            <h3>Password Reset Request</h3>
            <p>Hello ${user.name},</p>
            <p>You requested a password reset.</p>
            <a href="${resetLink}">Click here to reset your password.</a>
            <p>This link expires in 1 hour.</p>
        `;

        // 6. Send the email
        await sendMail(
            user.email,
            "[Global Blog Hub] Password Reset Request",
            mailContent
        );

        res.json({ success: true, message: "Password reset email sent." });

    } catch (error) {
        console.error("Password Reset Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while processing reset request." 
        });
    }
};


export const resetPasswordFinal = async (req, res) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    try {
        // 1. Verify token & expiry
        const user = await User.findOne({
            email,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid or expired reset link." 
            });
        }

        // 2. Update password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // 3. Clear reset token
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful!" });

    } catch (error) {
        console.error("Final Reset Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
