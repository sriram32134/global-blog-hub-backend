// server/controllers/contactController.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create a Nodemailer transporter object
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for port 465, false for 587 (TLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false, // Useful for self-signed certificates, generally kept false/omitted
    }
});

// Helper function to send email
const sendMail = async (to, subject, text, html) => {
    const mailOptions = {
        from: process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
    };
    await transporter.sendMail(mailOptions);
};


// ----------------------------------------------------
// 1. SEND CONTACT EMAIL (Public)
// We treat this endpoint as a simple contact form/utility
export const sendContactEmail = async (req, res) => {
    // Note: The frontend is currently only sending basic data, so we structure the body.
    const { email, subject, message } = req.body; 
    
    // Default admin email, or read from your contact list logic
    const ADMIN_EMAIL = "jnanaubbisetti@gmail.com"; 

    if (!email || !subject || !message) {
        return res.status(400).json({ success: false, message: "Email, subject, and message content are required." });
    }

    try {
        const mailContent = `
            <h3>New Contact Form Submission</h3>
            <p><strong>From:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
            <hr>
            <small>This was sent from the Global Blog Hub contact form.</small>
        `;

        await sendMail(
            ADMIN_EMAIL,
            `[GBH Contact] ${subject}`,
            message,
            mailContent
        );

        res.status(200).json({ success: true, message: "Your message has been sent successfully!" });

    } catch (error) {
        console.error("Nodemailer Error:", error);
        res.status(500).json({ success: false, message: "Failed to send message. Check SMTP credentials." });
    }
};