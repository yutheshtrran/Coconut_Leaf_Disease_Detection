const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    role: {
        type: String,
        enum: ['admin', 'farmer', 'agronomist', 'general'],
        default: 'general',
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    phoneNumber: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: '',
        maxlength: 2000,
    },
    profileImageUrl: {
        type: String,
        default: '',
    },
    profileImagePublicId: {
        type: String,
        default: '',
    },
    refreshTokens: {
        type: [String],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    resetPasswordToken: {
        type: String,
    },
    resetPasswordExpires: {
        type: Date,
    },
    resetPasswordCode: {
        type: String,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    verifyToken: {
        type: String,
    },
    verifyExpires: {
        type: Date,
    },
    verifyCode: {
        type: String,
    },
    verifyCodeExpires: {
        type: Date,
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false,
    },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    this.updatedAt = new Date();
    if (!this.isModified('password')) return next();
    // If password already looks like a bcrypt hash, skip re-hashing
    if (typeof this.password === 'string' && this.password.startsWith('$2')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    } catch (err) {
        return next(err);
    }
});

// Ensure updatedAt is set on findOneAndUpdate operations
userSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);