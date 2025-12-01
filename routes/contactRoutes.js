// server/routes/contactRoutes.js

import express from "express";
import { sendContactEmail } from "../controllers/contactController.js";

const router = express.Router();

// Public route for receiving contact form submissions
router.post("/", sendContactEmail); // POST /api/contact

export default router;