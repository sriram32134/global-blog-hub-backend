import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library'; // For validating the token

// We assume the user has Node environment access to process.env.GOOGLE_CLIENT_ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ⭐ NEW CONTROLLER: Handles Google ID token validation and user creation/login
export const googleAuth = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ success: false, message: "Google ID token is required." });
    }

    try {
        // 1. Verify the ID token using the Google Auth Library
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;
        
        // 2. Find or Create the user in the database
        let user = await User.findOne({ email });

        if (user) {
            // User exists, log them in
            // Ensure necessary fields are updated/selected (like profile picture if changed)
            user.name = name;
            user.profilePicture = picture;
            await user.save();
        } else {
            // User does not exist, register them
            // NOTE: Google users do not have a password set
            user = await User.create({
                name: name,
                email: email,
                password: 'GOOGLE_AUTH_PLACEHOLDER', // Placeholder password for validation/non-email logins
                profilePicture: picture,
                handle: email.split('@')[0],
                // Add Google ID for future reference
                googleId: googleId, 
            });
        }

        // 3. Generate application JWT
        const token = generateToken(user._id, user.role);

        // 4. Return user data and token
        return res.json({
            success: true,
            message: "Google login successful",
            token,
            user: {
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role,
                profilePicture: user.profilePicture, 
                handle: user.handle, 
                about: user.about 
            },
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        return res.status(401).json({ success: false, message: "Invalid Google ID token or server error." });
    }
};