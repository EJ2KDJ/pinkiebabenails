const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../models');

const router = express.Router();

const SERVICES = [
    'Soft gel extensions',
    'Gel manicure',
    'Manicure',
    'Pedicure',
    'Other',
];

const inquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { errors: ['Too many inquiries from this IP, please try again later.'] },
});

const validateInquiry = [
    body('name').trim().notEmpty().withMessage('Please enter your name.').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    body('phoneNumber')
        .trim()
        .matches(/^[0-9+\-\s()]{7,20}$/)
        .withMessage('Please enter a valid phone number.'),
    body('service').isIn(SERVICES).withMessage('Please choose a service.'),
    body('preferredDateTime')
        .isISO8601()
        .withMessage('Please choose a preferred date and time.')
        .bail()
        .custom((value) => new Date(value) > new Date())
        .withMessage('Preferred date and time must be in the future.'),
    body('nailDesignReference').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
    body('gelProductRemovalNeeded').isBoolean().withMessage('Please choose Yes or No.').toBoolean(),
];

async function sendOwnerEmail(inquiry) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !OWNER_EMAIL) {
        console.warn('Email not sent: SMTP settings are missing in .env.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const when = new Date(inquiry.preferredDateTime).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'short',
    });

    await transporter.sendMail({
        from: SMTP_USER,
        to: OWNER_EMAIL,
        replyTo: inquiry.email,
        subject: `New inquiry from ${inquiry.name}`,
        text: [
            `Name: ${inquiry.name}`,
            `Email: ${inquiry.email}`,
            `Phone: ${inquiry.phoneNumber}`,
            `Service: ${inquiry.service}`,
            `Preferred date and time: ${when}`,
            `Nail design or reference: ${inquiry.nailDesignReference || '(none)'}`,
            `Gel/product removal needed: ${inquiry.gelProductRemovalNeeded ? 'Yes' : 'No'}`,
        ].join('\n'),
    });
}

router.post('/', inquiryLimiter, validateInquiry, async (req, res) => {
    // Hidden "website" field: real visitors leave it empty, bots tend to fill it in.
    if (req.body.website) {
        return res.status(201).json({ message: 'Inquiry received.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map((e) => e.msg) });
    }

    try {
        const inquiry = await db.Inquiry.create({
            name: req.body.name,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            service: req.body.service,
            preferredDateTime: req.body.preferredDateTime,
            nailDesignReference: req.body.nailDesignReference || null,
            gelProductRemovalNeeded: req.body.gelProductRemovalNeeded,
        });

        // The inquiry is already saved, so an email problem should not fail the request.
        try {
            await sendOwnerEmail(inquiry);
        } catch (mailError) {
            console.error('Owner email failed:', mailError.message);
        }

        return res.status(201).json({ message: 'Inquiry received.' });
    } catch (error) {
        console.error('Saving inquiry failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

module.exports = router;