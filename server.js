import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import commentRoutes from "./routes/commentRoutes.js"; 
import userRoutes from "./routes/userRoutes.js";
import { googleAuth } from "./controllers/authController.js"; // ⭐ Import the new Google Auth controller

dotenv.config();
const app = express();

app.use(cors());

// --- Increase request limit for large Base64 images ---
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 
// -----------------------------------------------------------

// DB CONNECT
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err.message));

// ROUTES
app.use("/api/auth", authRoutes); // user register + login + Google Auth
app.use("/api/admin", adminRoutes); // admin controls
app.use("/api/user", userRoutes);

app.get("/", (req, res) => res.send("Backend running"));
app.use("/api/blogs", blogRoutes);
app.use("/api/comments", commentRoutes); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);