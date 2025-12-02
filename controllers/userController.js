import User from "../models/User.js";
import Blog from "../models/Blog.js";
import bcrypt from "bcryptjs";
import imagekit from "../config/imagekit.js";
import mongoose from "mongoose";
import crypto from "crypto";
// ⭐ REMOVED NODEMAILER (to fix ETIMEDOUT)
import SibApiV3Sdk from "@sendinblue/client"; // Use Brevo for transactional emails

// Configure Brevo API client
const brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
brevoClient.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// ----------------------------------------------------
// HELPER: SEND EMAIL USING BREVO (REPLACES SMTP)
const sendMail = async (to, subject, html) => {
  try {
    await brevoClient.sendTransacEmail({
      sender: { email: process.env.SMTP_USER, name: "Global Blog Hub" }, // SMTP_USER must be your Brevo verified sender
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    });
  } catch (error) {
    // Log Brevo specific errors if needed
    console.error("Brevo Email Error:", error.response?.text || error.message);
    throw new Error("Failed to send email via Brevo.");
  }
};

// ERROR HANDLER
const handleMongooseError = (res, err) => {
  console.error("Mongoose Error:", err);
  res.status(500).json({ success: false, message: "Server error" });
};

// ----------------------------------------------------
// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, handle, about } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { name, handle, about } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile updated successfully.", user: updatedUser });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "That handle is already taken." });
    }
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Current password incorrect." });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });

  } catch (error) {
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// UPDATE PROFILE PICTURE
export const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coverImageBase64, fileName } = req.body;

    const img = await imagekit.upload({
      file: coverImageBase64,
      fileName: fileName || `${userId}_profile.jpg`,
      folder: "/user_profiles",
    });

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { profilePicture: img.url } },
      { new: true }
    ).select("-password");

    res.json({ success: true, message: "Profile picture updated.", user: updated });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to upload image." });
  }
};

// ----------------------------------------------------
// GET PUBLIC USER PROFILE
export const getUserProfileById = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select(
      "name handle about profilePicture followers"
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const postsCount = await Blog.countDocuments({ author: userId, status: "Published" });

    res.json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        handle: user.handle,
        about: user.about,
        profilePicture: user.profilePicture,
        followersCount: user.followers.length,
        followers: user.followers,
        postsCount,
      },
    });

  } catch (error) {
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// FOLLOWING LIST
export const getFollowingList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("following", "name handle profilePicture");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ following: user.following });
  } catch (error) {
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// FOLLOWERS LIST
export const getFollowersList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("followers", "name handle profilePicture");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ followers: user.followers });
  } catch (error) {
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// FOLLOW / UNFOLLOW
export const toggleFollow = async (req, res) => {
  try {
    const target = req.params.userId;
    const userId = req.user.id;

    if (target === userId)
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });

    const user = await User.findById(userId);
    const other = await User.findById(target);

    if (!user || !other)
      return res.status(404).json({ success: false, message: "User not found" });

    const already = user.following.includes(target);

    if (already) {
      await User.findByIdAndUpdate(userId, { $pull: { following: target } });
      await User.findByIdAndUpdate(target, { $pull: { followers: userId } });
      return res.json({ success: true, following: false, message: "Unfollowed" });
    } else {
      await User.findByIdAndUpdate(userId, { $push: { following: target } });
      await User.findByIdAndUpdate(target, { $push: { followers: userId } });
      return res.json({ success: true, following: true, message: "Following" });
    }

  } catch (error) {
    handleMongooseError(res, error);
  }
};

// ----------------------------------------------------
// REQUEST PASSWORD RESET (BREVO API)
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ success: false, message: "Email required." });

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists, a recovery email was sent.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken: token,
      resetPasswordExpires: Date.now() + 3600000,
    });

    // Use the corrected production domain for the reset link
    const FRONTEND = "https://global-blog-hub-frontend.vercel.app"; 

    const link = `${FRONTEND}/reset-password?token=${token}&email=${email}`;

    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${user.name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${link}">Reset Password</a>
      <p>Link expires in 1 hour.</p>
    `;

    await sendMail(user.email, "[Global Blog Hub] Password Reset Request", html);

    res.json({ success: true, message: "Password reset email sent." });

  } catch (error) {
    console.error("Password Reset Error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reset email.",
    });
  }
};

// ----------------------------------------------------
// FINAL RESET PASSWORD
export const resetPasswordFinal = async (req, res) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Missing fields.",
    });
  }

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ success: true, message: "Password reset successful!" });

  } catch (error) {
    console.error("Final Reset Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};