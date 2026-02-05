const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();
const crypto = require('crypto');
const { sendMail } = require('../services/emailService');
const { getVerificationEmailTemplate } = require('../utils/emailTemplates');
const PendingUser = require('../models/PendingUser');
const bcrypt = require('bcrypt');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || process.env.JWT_EXPIRES_IN || '7d';

const signAccessToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
const signRefreshToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: REFRESH_EXPIRES });

// generate alphanumeric code of given length
function generateCode(length = 6) {
  const chars = '0123456789';
  let ret = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, chars.length);
    ret += chars[idx];
  }
  return ret;
}

// Step 1: Start registration - create a pending user and email a 6-digit code
exports.startRegister = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Missing fields: username, email, and password are required.' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: 'Invalid email format' });
    const strong = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
    if (!strong) return res.status(400).json({ message: 'Weak password: use 8+ chars incl. upper, lower, and a number.' });

    // validate role (registration cannot select admin)
    const allowedRoles = ['farmer', 'agronomist', 'general'];
    const selectedRole = allowedRoles.includes(role) ? role : 'general';

    // ensure no existing user with same email or username
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    // remove any existing pending for same email
    await PendingUser.deleteMany({ email });

    // generate 6-char alphanumeric code
    const code = generateCode(6);

    // store hashed password in pending
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const pending = await PendingUser.create({ username, email, passwordHash, role: selectedRole, code, expiresAt });

    // send code via email
    try {
      const subject = 'Coco Guard Verification Code';
      const text = `Your verification code is: ${code}. It expires in 15 minutes.`;
      const html = getVerificationEmailTemplate(code, 'Registration');
      await sendMail({ to: email, subject, text, html });
    } catch (mailErr) {
      console.error('Error sending registration code', mailErr);
    }

    return res.json({ message: 'Verification code sent to email' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// Step 2: Confirm registration with code - create real user and return tokens
exports.confirmRegister = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code required' });

    const pending = await PendingUser.findOne({ email, code });
    if (!pending) return res.status(400).json({ message: 'Invalid code or email' });
    if (pending.expiresAt < new Date()) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'Code expired' });
    }

    // create User using stored hash (User pre-save skips rehash when starts with $2)
    const user = new User({ username: pending.username, email: pending.email, password: pending.passwordHash, role: pending.role || 'general', emailVerified: true });
    // create tokens
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save();

    // cleanup pending
    await PendingUser.deleteOne({ _id: pending._id });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
    };
    res.cookie('token', accessToken, { ...cookieOptions, maxAge: msToNum(ACCESS_EXPIRES) });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: msToNum(REFRESH_EXPIRES) });

    return res.status(201).json({ user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/register/resend - resend code for pending registration
exports.resendPendingCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const pending = await PendingUser.findOne({ email });
    if (!pending) return res.status(200).json({ message: 'If that email has a pending registration, a code was sent' });

    // regenerate alphanumeric code and extend expiry
    const code = generateCode(6);
    pending.code = code;
    pending.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pending.save();

    try {
      const subject = 'Coco Guard Verification Code';
      const text = `Your verification code is: ${code}. It expires in 15 minutes.`;
      const html = getVerificationEmailTemplate(code, 'Registration');
      await sendMail({ to: email, subject, text, html });
    } catch (mailErr) {
      console.error('Error sending registration code', mailErr);
    }

    return res.json({ message: 'If that email has a pending registration, a code was sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/verification-status - check whether email is pending/user exists/verified
exports.verificationStatus = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const pending = await PendingUser.findOne({ email });
    const user = await User.findOne({ email });
    return res.json({ pending: !!pending, userExists: !!user, emailVerified: !!(user && user.emailVerified) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) return res.status(400).json({ message: 'Missing fields' });

    const user = await User.findOne({ $or: [{ email: emailOrUsername }, { username: emailOrUsername }] });
    if (!user) return res.status(404).json({ message: 'This email/username is not registered' });

    if (!user.emailVerified) return res.status(403).json({ message: 'Email not verified' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Wrong password' });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // store refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
    };

    res.cookie('token', accessToken, { ...cookieOptions, maxAge: msToNum(ACCESS_EXPIRES) });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: msToNum(REFRESH_EXPIRES) });

    return res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    const rToken = req.cookies?.refreshToken;
    if (rToken) {
      // remove refresh token from DB (if user found)
      try {
        const decoded = jwt.verify(rToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshTokens = user.refreshTokens.filter((t) => t !== rToken);
          await user.save();
        }
      } catch (e) {
        // ignore
      }
    }

    const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' };
    res.clearCookie('token', cookieOpts);
    res.clearCookie('refreshToken', cookieOpts);
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    res.json({ user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh token endpoint
exports.refresh = async (req, res) => {
  try {
    const rToken = req.cookies?.refreshToken || (req.body && req.body.refreshToken);
    if (!rToken) return res.status(401).json({ message: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(rToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    // Check token exists in DB
    if (!user.refreshTokens.includes(rToken)) {
      // possible reuse/replay attack — clear all refresh tokens
      user.refreshTokens = [];
      await user.save();
      return res.status(401).json({ message: 'Refresh token not recognized' });
    }

    // rotate: remove the old refresh token and issue a new one
    user.refreshTokens = user.refreshTokens.filter((t) => t !== rToken);
    const newRefresh = signRefreshToken(user._id);
    user.refreshTokens.push(newRefresh);
    await user.save();

    const newAccess = signAccessToken(user._id);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
    };

    res.cookie('token', newAccess, { ...cookieOptions, maxAge: msToNum(ACCESS_EXPIRES) });
    res.cookie('refreshToken', newRefresh, { ...cookieOptions, maxAge: msToNum(REFRESH_EXPIRES) });

    return res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/forgot
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link was sent' });
    // generate code and store
    const code = generateCode(6);
    user.resetPasswordCode = code;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // send code via email
    const subject = 'Coco Guard Verification Code';
    const text = `Your password reset code is: ${code}. It expires in 1 hour.`;
    const html = getVerificationEmailTemplate(code, 'Password Reset');
    try {
      await sendMail({ to: user.email, subject, text, html });
    } catch (mailErr) {
      console.error('Error sending reset code email', mailErr);
    }

    return res.json({ message: 'If that email exists, a reset code was sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/forgot/confirm - confirm reset with code and new password
exports.forgotConfirm = async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return res.status(400).json({ message: 'Email, code and new password required' });
    const user = await User.findOne({ email, resetPasswordCode: code, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired code' });

    user.password = password;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been reset' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/resend - resend verification email
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'If that email exists, a verification code was sent' });
    if (user.emailVerified) return res.status(400).json({ message: 'Email already verified' });

    // generate code and store
    const code = generateCode(6);
    user.verifyCode = code;
    user.verifyCodeExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();


    const subject = 'Coco Guard Verification Code';
    const text = `Your verification code is: ${code}. It expires in 24 hours.`;
    const html = getVerificationEmailTemplate(code, 'Verification');
    try {
      await sendMail({ to: user.email, subject, text, html });
    } catch (mailErr) {
      console.error('Verification resend email error:', mailErr);
    }

    return res.json({ message: 'If that email exists, a verification code was sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/reset
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and new password required' });
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/verify - verify existing user's email using code and email
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code required' });

    const user = await User.findOne({ email, verifyCode: code, verifyCodeExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired code' });

    user.emailVerified = true;
    user.verifyCode = undefined;
    user.verifyCodeExpires = undefined;
    await user.save();

    return res.json({ message: 'Email verified' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Helper: convert expiry string (e.g., '15m','7d') to ms number (approx)
function msToNum(exp) {
  if (!exp) return 1000 * 60 * 60 * 24 * 7;
  // simple parser: supports s, m, h, d
  const match = String(exp).match(/^(\d+)([smhd])$/);
  if (!match) {
    // default to days if '7d' or a number
    if (exp.endsWith('d')) {
      const n = parseInt(exp.slice(0, -1), 10) || 7;
      return n * 24 * 60 * 60 * 1000;
    }
    return 1000 * 60 * 60 * 24 * 7;
  }
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return n * 1000;
  }
}
