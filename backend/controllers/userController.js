// User controller for handling user-related operations

const User = require('../models/User');

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
    const { username, email } = req.body;

    try {
        const user = await User.findByIdAndUpdate(req.user.id, { username, email }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User profile updated', user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user profile', error });
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
<<<<<<< HEAD
=======
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

// Admin: delete a user by ID
exports.adminDeleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ message: 'User ID required' });
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        await User.deleteOne({ _id: id });
        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Admin delete user error:', error);
        return res.status(500).json({ message: 'Error deleting user', error });
    }
>>>>>>> origin/dev-m3
};