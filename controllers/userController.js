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
// client/components/UserDashboard/ProfileSettings.jsx (COMPLETE FIXED CODE)

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateGeneralProfile, updatePassword, updateProfilePic } from '../../services/blogService'; 
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom'; // ⭐ REQUIRED FOR SOFT NAVIGATION

// Function to convert File object to Base64 string (local utility)
const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

const ProfileSettings = () => {
    // ⭐ Initialize navigate hook
    const navigate = useNavigate(); 
    
    // Get user state from AuthContext
    const { user, login } = useAuth(); 

    // State for general details
    const [name, setName] = useState(user?.name || '');
    const [handle, setHandle] = useState(user?.handle || user?.email?.split('@')[0] || '');
    const [bio, setBio] = useState(user?.about || 'Welcome to my corner of the blogosphere.');
    const [pictureFile, setPictureFile] = useState(null);

    // State for password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // ⭐ FIX: Uses soft navigation to prevent Vercel 404/Routing issues
    const refreshAuthContext = (updatedUser) => {
        const stored = localStorage.getItem("blog_user");
        const token = stored ? JSON.parse(stored).token : null;
        
        if (token) {
            const newUserData = {
                ...updatedUser,
                token: token,
            };
            
            // 1. Update localStorage (for persistence)
            localStorage.setItem("blog_user", JSON.stringify(newUserData));
            
            // 2. Navigate smoothly back to the dashboard to force AuthContext/Navbar re-render.
            navigate('/dashboard'); 
        }
    };


    // --- Profile Picture Handler ---
    const handlePictureChange = (e) => {
        setPictureFile(e.target.files[0]);
    };

    const handleUploadPicture = async (e) => {
        e.preventDefault();
        if (!pictureFile) {
            toast.warn("Please select a new picture to upload.");
            return;
        }

        setLoading(true);
        try {
            const base64Image = await convertFileToBase64(pictureFile);
            
            const response = await updateProfilePic({
                coverImageBase64: base64Image,
                fileName: pictureFile.name,
            });
            
            toast.success("Profile picture updated successfully!");
            setPictureFile(null); 
            refreshAuthContext(response.user); // ⭐ Uses soft navigation fix

        } catch (error) {
            toast.error(error.message || 'Failed to upload profile picture.');
        } finally {
            setLoading(false);
        }
    }

    // --- Profile Details Handler ---
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const response = await updateGeneralProfile({ name, handle, about: bio });

            toast.success("Profile details updated successfully!");
            refreshAuthContext(response.user); // ⭐ Uses soft navigation fix

        } catch (error) {
            setMessage('❌ ' + (error.message || 'Failed to update profile.'));
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // --- Password Change Handler ---
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        if (newPassword.length < 6) {
            setMessage('❌ Password must be at least 6 characters long.');
            setLoading(false);
            return;
        }

        try {
            await updatePassword({ currentPassword, newPassword });
            
            setMessage('✅ Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
        } catch (error) {
            setMessage('❌ ' + (error.message || 'Failed to change password.'));
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="p-3 w-100">
            <h3 className="mb-4 text-primary"><i className="bi bi-person-circle me-2"></i> Account Settings</h3>
            
            {message && <div className={`alert ${message.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>{message}</div>}

            {/* Profile Header & Picture Upload */}
            <div className="card p-4 shadow-lg mb-4">
                <div className="d-flex align-items-center mb-4 border-bottom pb-4">
                    <img 
                        src={user?.profilePicture || "https://placehold.co/100x100/94A3B8/FFFFFF?text=P"} 
                        alt="Profile Picture" 
                        className="rounded-circle me-4 shadow"
                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                    />
                    <div>
                        <h4 className="fw-bold mb-0">{user?.name}</h4>
                        <p className="text-primary small mb-0">@{user?.handle || 'n/a'}</p>
                        <p className="text-muted small mt-1">{user?.email}</p>
                    </div>
                </div>
                
                {/* Profile Picture Upload Form */}
                <form onSubmit={handleUploadPicture}>
                    <label className="form-label">Change Profile Picture</label>
                    <div className="input-group">
                        <input 
                            type="file" 
                            className="form-control" 
                            onChange={handlePictureChange} 
                            accept="image/*"
                            disabled={loading}
                        />
                        <button className="btn btn-outline-primary" type="submit" disabled={loading || !pictureFile}>
                            {loading ? 'Uploading...' : 'Upload New Picture'}
                        </button>
                    </div>
                    {pictureFile && <small className='text-muted'>Selected: {pictureFile.name}</small>}
                </form>

            </div>

            {/* Profile Update Form */}
            <div className="card p-4 shadow-lg mb-4">
                <h5 className="mb-3">Update Profile Details</h5>
                <form onSubmit={handleUpdateProfile} className="row g-3">
                    <div className="col-md-6">
                        <label className="form-label">Full Name</label>
                        <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Public Handle / Username</label>
                        <input type="text" className="form-control" value={handle} onChange={(e) => setHandle(e.target.value)} required disabled={loading} />
                        <small className="text-muted">Used in profile links, e.g., @{handle}</small>
                    </div>
                    <div className="col-12">
                        <label className="form-label">About / Bio</label>
                        <textarea className="form-control" rows="3" value={bio} onChange={(e) => setBio(e.target.value)} disabled={loading}></textarea>
                    </div>
                    <div className="col-12 mt-4">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Profile Details'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Password Change Section */}
            <div className="card p-4 shadow-sm">
                <h5>Change Password</h5>
                <form onSubmit={handleChangePassword} className="row g-3">
                    <div className="col-md-6">
                        <label className="form-label">Current Password</label>
                        <input type="password" className="form-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={loading} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">New Password</label>
                        <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} />
                    </div>
                    <div className="col-12 mt-4">
                        <button type="submit" className="btn btn-warning" disabled={loading || !currentPassword || !newPassword}>
                            {loading ? 'Changing...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSettings;