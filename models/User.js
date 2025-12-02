import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    profilePicture: {
      type: String,
      default: "https://placehold.co/100x100/94A3B8/FFFFFF?text=P",
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
      default: "Welcome to my corner of the blogosphere.",
    },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ⭐ REQUIRED FOR PASSWORD RESET
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
