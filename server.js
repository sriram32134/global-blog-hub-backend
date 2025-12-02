import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
// import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();
const app = express();

/* ==========================================
   CORS CONFIG (FIXED)
========================================== */

const allowedOrigins = [
  "https://global-blog-hub-frontend-git-master-srirams-projects-eb1c82e6.vercel.app/",                                   // Production
  "https://global-blog-hub-frontend-git-master-srirams-projects-eb1c82e6.vercel.app", // Vercel Preview
  "http://localhost:5173",  // Vite Dev
  "http://localhost:3000",  // React Dev
  "https://global-blog-hub-api.onrender.com" // Render Health Checks
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow server-to-server, curl, etc.

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ CORS BLOCKED ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ==========================================
   BODY PARSERS
========================================== */

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ==========================================
   DATABASE CONNECTION
========================================== */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("DB Error:", err.message));

/* ==========================================
   ROUTES
========================================== */

app.get("/", (req, res) => res.send("Backend running"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/comments", commentRoutes);
// app.use("/api/contact", contactRoutes);

/* ==========================================
   START SERVER
========================================== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
