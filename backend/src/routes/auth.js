const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const db = require('../models');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../../middleware/auth');

const router = express.Router();
const PASSWORD_HASH_ROUNDS = 12;
const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many login attempts. Please try again later.'] },
});
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many owner sign-in attempts. Please try again later.'] },
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many signup attempts. Please try again later.'] },
});
const recoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many password recovery attempts. Please try again later.'] },
});

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

function validationErrors(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    res.status(400).json({ errors: errors.array().map((error) => error.msg) });
    return true;
}

function emailValidation() {
    return body('email')
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email address.')
        .bail()
        .customSanitizer((email) => email.toLowerCase());
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
    };
}

function mailTransport() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
}

router.post(
    '/register',
    registerLimiter,
    body('name').trim().notEmpty().withMessage('Please enter your name.').isLength({ max: 100 }),
    emailValidation(),
    body('phoneNumber')
        .trim()
        .matches(/^[0-9+\-\s()]{7,20}$/)
        .withMessage('Please enter a valid phone number.'),
    body('password')
        .isLength({ min: 8, max: 72 })
        .withMessage('Your password must be between 8 and 72 characters.')
        .custom((password) => typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72)
        .withMessage('Your password must be 72 bytes or fewer.'),
    async (req, res) => {
        if (validationErrors(req, res)) return;

        try {
            const passwordHash = await bcrypt.hash(req.body.password, PASSWORD_HASH_ROUNDS);
            const user = await db.User.create({
                name: req.body.name,
                email: req.body.email,
                phoneNumber: req.body.phoneNumber,
                passwordHash,
                role: 'customer',
            });
            setAuthCookie(res, user);
            return res.status(201).json({ user: publicUser(user) });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ errors: ['An account with that email already exists.'] });
            }
            console.error('Account signup failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.post(
    '/login',
    loginLimiter,
    emailValidation(),
    body('password').notEmpty().withMessage('Please enter your password.'),
    async (req, res) => {
        if (validationErrors(req, res)) return;

        try {
            const user = await db.User.findOne({ where: { email: req.body.email } });
            const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);
            if (!passwordMatches || user.role === 'admin') {
                return res.status(401).json({ errors: ['Invalid email or password.'] });
            }
            setAuthCookie(res, user);
            return res.json({ user: publicUser(user) });
        } catch (error) {
            console.error('Login failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.post(
    '/admin-login',
    adminLoginLimiter,
    emailValidation(),
    body('password').notEmpty().withMessage('Please enter your password.'),
    async (req, res) => {
        if (validationErrors(req, res)) return;

        try {
            const user = await db.User.findOne({ where: { email: req.body.email } });
            const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);
            if (!passwordMatches || user.role !== 'admin') {
                return res.status(401).json({ errors: ['Invalid owner email or password.'] });
            }
            setAuthCookie(res, user);
            return res.json({ user: publicUser(user) });
        } catch (error) {
            console.error('Owner login failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    return res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await db.User.findByPk(req.user.id);
        if (!user) {
            clearAuthCookie(res);
            return res.status(401).json({ errors: ['Please log in.'] });
        }
        return res.json({ user: publicUser(user) });
    } catch (error) {
        console.error('Loading current user failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

router.post(
    '/forgot-password',
    recoveryLimiter,
    emailValidation(),
    async (req, res) => {
        if (validationErrors(req, res)) return;

        const transporter = mailTransport();
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        if (!transporter || (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL)) {
            console.error('Password recovery is unavailable: SMTP settings or FRONTEND_URL are missing.');
            return res.status(503).json({ errors: ['Password recovery is temporarily unavailable. Please try again later.'] });
        }

        try {
            const user = await db.User.findOne({ where: { email: req.body.email } });
            if (!user) {
                return res.json({ message: 'If an account exists for that email, a reset link will be sent.' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS);
            await user.update({
                resetPasswordTokenHash: tokenHash,
                resetPasswordExpiresAt: expiresAt,
            });

            const resetUrl = new URL('/login.html', frontendUrl);
            resetUrl.searchParams.set('token', token);
            resetUrl.searchParams.set('mode', 'reset');
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: user.email,
                    subject: 'Reset your PinkieBabe Nails password',
                    text: `Use this link within one hour to reset your password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
                });
            } catch (mailError) {
                await user.update({ resetPasswordTokenHash: null, resetPasswordExpiresAt: null });
                throw mailError;
            }

            return res.json({ message: 'If an account exists for that email, a reset link will be sent.' });
        } catch (error) {
            console.error('Password reset email failed:', error.message);
            return res.status(500).json({ errors: ['Could not send a password reset email. Please try again later.'] });
        }
    }
);

router.post(
    '/reset-password',
    recoveryLimiter,
    body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('This reset link is invalid or has expired.'),
    body('password')
        .isLength({ min: 8, max: 72 })
        .withMessage('Your password must be between 8 and 72 characters.')
        .custom((password) => typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72)
        .withMessage('Your password must be 72 bytes or fewer.'),
    async (req, res) => {
        if (validationErrors(req, res)) return;

        try {
            const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
            const user = await db.User.findOne({
                where: {
                    resetPasswordTokenHash: tokenHash,
                    resetPasswordExpiresAt: { [db.Sequelize.Op.gt]: new Date() },
                },
            });
            if (!user) {
                return res.status(400).json({ errors: ['This reset link is invalid or has expired.'] });
            }

            const passwordHash = await bcrypt.hash(req.body.password, PASSWORD_HASH_ROUNDS);
            await user.update({
                passwordHash,
                resetPasswordTokenHash: null,
                resetPasswordExpiresAt: null,
            });
            return res.json({ message: 'Your password has been reset. You can now log in.' });
        } catch (error) {
            console.error('Password reset failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

module.exports = router;
