// User controller for handling user-related operations

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Register a new user
exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const newUser = new User({ username, email, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
};

// Login a user
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile', error });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    // Allow updating username (display name), phoneNumber, bio; do NOT allow email here
    const { username, phoneNumber, bio, currentPassword } = req.body;
    // Debug log for troubleshooting profile updates
    console.log('Profile update request', { userId: req.user?.id, username, phoneNumber, bioLength: (bio || '').length });

    try {
        if (!currentPassword || typeof currentPassword !== 'string') {
            return res.status(401).json({ message: 'Current password required to save changes.' });
        }

        const userDoc = await User.findById(req.user.id).select('+password');
        if (!userDoc) {
            return res.status(404).json({ message: 'User not found' });
        }
        const passOk = await bcrypt.compare(currentPassword, userDoc.password);
        if (!passOk) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const updates = {};
        if (typeof username === 'string') {
            const trimmed = username.trim();
            if (trimmed.length === 0) {
                return res.status(400).json({ message: 'Name is required and cannot be empty.' });
            }
            updates.username = trimmed;
        }
        if (typeof bio === 'string') {
            updates.bio = bio.slice(0, 2000);
        }

        if (typeof phoneNumber === 'string') {
            const sanitized = phoneNumber.replace(/[\s\-()]/g, '');
            if (sanitized.length > 0) {
                const e164 = /^\+?[1-9]\d{1,14}$/;
                if (!e164.test(sanitized)) {
                    return res.status(400).json({
                        message: 'Invalid phone number format. Use E.164 (e.g., +94771234567).',
                    });
                }
                updates.phoneNumber = sanitized;
            } else {
                updates.phoneNumber = '';
            }
        }

        Object.assign(userDoc, updates);
        await userDoc.save();
        const userSafe = userDoc.toObject();
        delete userSafe.password;
        delete userSafe.refreshTokens;
        delete userSafe.resetPasswordToken;
        delete userSafe.resetPasswordExpires;
        res.status(200).json({ message: 'User profile updated', user: userSafe });
    } catch (error) {
        console.error('Error updating user profile:', error);
        // Map common Mongoose validation errors to 400 for better UX
        if (error && (error.name === 'ValidationError' || error.name === 'MongoServerError')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating user profile', error });
    }
};

// Upload/update profile photo
exports.uploadProfilePhoto = async (req, res) => {
    try {
        const { currentPassword } = req.body || {};
        if (!currentPassword || typeof currentPassword !== 'string') {
            return res.status(401).json({ message: 'Current password required to save changes.' });
        }

        const userForPass = await User.findById(req.user.id).select('+password');
        if (!userForPass) {
            return res.status(404).json({ message: 'User not found' });
        }
        const ok = await bcrypt.compare(currentPassword, userForPass.password);
        if (!ok) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Ensure Cloudinary is configured
        const cloudinary = require('../services/cloudinary');
        if (!cloudinary.config().cloud_name) {
            return res.status(500).json({ message: 'Image service not configured' });
        }

        // If user already has an image, try to delete the previous one
        const existing = await User.findById(req.user.id).select('profileImagePublicId');
        if (!existing) return res.status(404).json({ message: 'User not found' });
        if (existing.profileImagePublicId) {
            try { await cloudinary.uploader.destroy(existing.profileImagePublicId); } catch (_) {}
        }

        // Upload buffer as base64 data URI to Cloudinary
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const result = await cloudinary.uploader.upload(base64, {
            folder: 'coco-guard/profiles',
            overwrite: true,
            invalidate: true,
        });

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profileImageUrl: result.secure_url, profileImagePublicId: result.public_id },
            { new: true }
        ).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Keep messaging unified with profile flow
        res.status(200).json({ message: 'User profile updated', user });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ message: 'Error uploading profile photo', error });
    }
};

// Delete user account
exports.deleteUserAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user.id);
        res.status(200).json({ message: 'User account deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user account', error });
    }
};

// Admin: list all users
exports.listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires');
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Error listing users', error });
    }
};

// Delete profile photo (requires current password)
exports.deleteProfilePhoto = async (req, res) => {
    try {
        const { currentPassword } = req.body || {};
        if (!currentPassword || typeof currentPassword !== 'string') {
            return res.status(401).json({ message: 'Current password required to save changes.' });
        }

        const userDoc = await User.findById(req.user.id).select('password profileImagePublicId');
        if (!userDoc) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (typeof userDoc.password !== 'string') {
            return res.status(500).json({ message: 'Password unavailable for verification' });
        }
        const ok = await bcrypt.compare(currentPassword, userDoc.password);
        if (!ok) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const cloudinary = require('../services/cloudinary');
        if (userDoc.profileImagePublicId) {
            try { await cloudinary.uploader.destroy(userDoc.profileImagePublicId); } catch (_) {}
        }
        userDoc.profileImageUrl = '';
        userDoc.profileImagePublicId = '';
        await userDoc.save();

        const safe = userDoc.toObject();
        delete safe.password;
        delete safe.refreshTokens;
        delete safe.resetPasswordToken;
        delete safe.resetPasswordExpires;
        res.status(200).json({ message: 'User profile updated', user: safe });
    } catch (error) {
        console.error('Error deleting profile photo:', error);
        res.status(500).json({ message: 'Error deleting profile photo', error });
    }
};

// Admin: update a user's role or status
exports.adminUpdateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, status } = req.body || {};

        const update = {};
        if (typeof role === 'string') {
            const allowed = ['admin', 'farmer', 'agronomist', 'general'];
            if (!allowed.includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            update.role = role;
        }
        if (typeof status === 'string') {
            const allowedS = ['active', 'inactive'];
            if (!allowedS.includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            update.status = status;
        }
        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: 'No changes provided' });
        }

        const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires');
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json({ message: 'User updated', user });
    } catch (error) {
        console.error('Admin update user error:', error);
        return res.status(500).json({ message: 'Error updating user', error });
    }
};

// Update security settings: change password and toggle 2FA (requires current password)
exports.updateUserSecurity = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword, twoFactorEnabled } = req.body || {};

        if (!currentPassword || typeof currentPassword !== 'string') {
            return res.status(400).json({ message: 'Current password required to update security settings.' });
        }

        const userDoc = await User.findById(req.user.id).select('+password');
        if (!userDoc) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (typeof userDoc.password !== 'string') {
            return res.status(500).json({ message: 'Password unavailable for verification' });
        }

        const passOk = await bcrypt.compare(currentPassword, userDoc.password);
        if (!passOk) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        let changed = false;

        // Handle password change if provided
        if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
            const pwd = newPassword.trim();
            const strong = pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
            if (!strong) {
                return res.status(400).json({ message: 'Weak password: use 8+ chars incl. upper, lower, and a number.' });
            }
            if (pwd !== (confirmPassword || '')) {
                return res.status(400).json({ message: 'New password and confirmation do not match.' });
            }
            userDoc.password = pwd; // will be hashed by pre-save hook
            changed = true;
        }

        // Handle 2FA toggle if provided
        if (typeof twoFactorEnabled === 'boolean') {
            if (twoFactorEnabled === true) {
                const phone = (userDoc.phoneNumber || '').replace(/[\s\-()]/g, '');
                const e164 = /^\+?[1-9]\d{1,14}$/;
                if (!phone || !e164.test(phone)) {
                    return res.status(400).json({ message: 'To enable 2FA, set a valid phone number in your profile (E.164 format, e.g., +94771234567).' });
                }
            }
            userDoc.twoFactorEnabled = twoFactorEnabled;
            changed = true;
        }

        if (!changed) {
            return res.status(400).json({ message: 'No security changes provided.' });
        }

        await userDoc.save();

        const safe = userDoc.toObject();
        delete safe.password;
        delete safe.refreshTokens;
        delete safe.resetPasswordToken;
        delete safe.resetPasswordExpires;
        return res.status(200).json({ message: 'Security settings updated', user: safe });
    } catch (error) {
        console.error('Error updating security settings:', error);
        return res.status(500).json({ message: 'Error updating security settings', error });
    }
};

// Admin: promote a user to admin by email
exports.adminPromoteByEmail = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ message: 'Email required' });
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.role = 'admin';
        await user.save();
        const safe = user.toObject();
        delete safe.password;
        delete safe.refreshTokens;
        delete safe.resetPasswordToken;
        delete safe.resetPasswordExpires;
        return res.json({ message: 'User promoted to admin', user: safe });
    } catch (error) {
        console.error('Admin promote by email error:', error);
        return res.status(500).json({ message: 'Error promoting user', error });
    }
};