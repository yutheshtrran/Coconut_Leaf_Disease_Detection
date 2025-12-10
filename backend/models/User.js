const mongoose = require('mongoose');

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
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Middleware to hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        // Hash the password here (use bcrypt or similar)
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;