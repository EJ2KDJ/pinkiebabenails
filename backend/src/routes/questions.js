const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many questions sent. Please try again later.'] },
});

router.post('/',
    limiter,
    body('name').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Enter your name (up to 100 characters).'),
    body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.'),
    body('message').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Write your question (up to 2000 characters).'),
    async (req, res) => {
        if (req.body.website) return res.status(201).json({ message: 'Question received.' });
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map((error) => error.msg) });

        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL } = process.env;
        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
            return res.status(503).json({ errors: ['Contact form is temporarily unavailable. Please email the salon instead.'] });
        }
        try {
            const transport = nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT) || 587,
                auth: { user: SMTP_USER, pass: SMTP_PASS },
            });
            await transport.sendMail({
                from: SMTP_USER,
                to: OWNER_EMAIL || 'pinkiebabenails@gmail.com',
                replyTo: req.body.email,
                subject: 'PinkieBabe Nails: question from website',
                text: ['Name: ' + req.body.name, 'Email: ' + req.body.email, '', 'Question:', req.body.message].join('\n'),
            });
            res.status(201).json({ message: 'Question received.' });
        } catch (error) {
            console.error('Sending question failed:', error.message);
            res.status(503).json({ errors: ['Unable to send your question right now. Please email the salon instead.'] });
        }
    }
);

module.exports = router;
