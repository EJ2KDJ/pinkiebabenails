const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../models');
const createBrandedEmail = require('../utils/branded-email');

const router = express.Router();

const SERVICES = [
    'Soft gel extensions',
    'Gel manicure',
    'Manicure',
    'Pedicure',
    'Other',
];

// Limit repeated submissions from one IP to reduce spam and accidental retries.
const inquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5, // limit each IP to 5 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { errors: ['Too many inquiries from this IP, please try again later.'] },
});

// Validate and normalize all client-supplied values before writing to the database.
const validateInquiry = [
    body('name').trim().notEmpty().withMessage('Please enter your name.').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Please enter a valid email address.'),
    body('message')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 5000 })
        .withMessage('Your message must be 5000 characters or fewer.'),
    body('phoneNumber')
        .optional({ values: 'falsy' })
        .trim()
        .matches(/^[0-9+\-\s()]{7,20}$/)
        .withMessage('Please enter a valid phone number.'),
    body('service').optional({ values: 'falsy' }).isIn(SERVICES).withMessage('Please choose a service.'),
    body('preferredDateTime')
        .optional({ values: 'falsy' })
        .isISO8601()
        .withMessage('Please choose a preferred date and time.')
        .bail()
        .custom((value) => {
            const date = new Date(value);
            return Number.isFinite(date.getTime()) && date > new Date();
        })
        .withMessage('Preferred date and time must be in the future.')
        .bail()
        .custom((value) => {
            const date = new Date(value);
            return date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
        })
        .withMessage('Please choose an appointment time on the hour.'),
    body('nailDesignReference').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
    body('gelProductRemovalNeeded')
        .optional()
        .isBoolean()
        .withMessage('Please choose Yes or No.')
        .toBoolean(),
    body().custom((_, { req }) => {
        const hasMessage = typeof req.body.message === 'string' && req.body.message.trim().length > 0;
        const hasAppointmentDetails = Boolean(
            req.body.phoneNumber
            && SERVICES.includes(req.body.service)
            && req.body.preferredDateTime
            && typeof req.body.gelProductRemovalNeeded === 'boolean'
        );
        return hasMessage || hasAppointmentDetails;
    }).withMessage('Please enter a message.'),
];

// Notify the owner while preserving the original inquiry as the reply-to address.
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

    const details = [];
    if (inquiry.phoneNumber) details.push({ label: 'Phone', value: inquiry.phoneNumber });
    if (inquiry.service) details.push({ label: 'Service', value: inquiry.service });
    if (inquiry.preferredDateTime) {
        const when = new Date(inquiry.preferredDateTime).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            dateStyle: 'full',
            timeStyle: 'short',
        });
        details.push({ label: 'Preferred date and time', value: when });
    }
    if (inquiry.nailDesignReference) {
        details.push({ label: 'Nail design or reference', value: inquiry.nailDesignReference });
    }
    if (inquiry.gelProductRemovalNeeded !== null && inquiry.gelProductRemovalNeeded !== undefined) {
        details.push({
            label: 'Gel/product removal needed',
            value: inquiry.gelProductRemovalNeeded ? 'Yes' : 'No',
        });
    }

    const message = inquiry.message || '(appointment inquiry)';
    const email = createBrandedEmail({
        title: 'New website inquiry',
        previewText: `New inquiry from ${inquiry.name}`,
        paragraphs: ['A customer has sent a message through the website.'],
        sections: [
            {
                heading: 'Inquiry details',
                items: [
                    { label: 'Name', value: inquiry.name },
                    { label: 'Email', value: inquiry.email },
                    { label: 'Message', value: message },
                ],
            },
            ...(details.length ? [{ heading: 'Appointment details', items: details }] : []),
        ],
        text: [
            `Name: ${inquiry.name}`,
            `Email: ${inquiry.email}`,
            `Message: ${message}`,
            ...details.map((detail) => `${detail.label}: ${detail.value}`),
        ].join('\n'),
    });

    await transporter.sendMail({
        from: SMTP_USER,
        to: OWNER_EMAIL,
        replyTo: inquiry.email,
        subject: `New inquiry from ${inquiry.name}`,
        ...email,
    });
}

router.post('/', inquiryLimiter, validateInquiry, async (req, res) => {
    // Silently accept honeypot submissions without storing or emailing them.
    if (req.body.website) {
        return res.status(201).json({ message: 'Inquiry received.' });
    }

    // Return validation errors before attempting any database writes.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map((e) => e.msg) });
    }

    try {
        // Persist first so mail delivery problems cannot discard a valid inquiry.
        const inquiry = await db.Inquiry.create({
            name: req.body.name,
            email: req.body.email,
            message: req.body.message || null,
            phoneNumber: req.body.phoneNumber || null,
            service: req.body.service || null,
            preferredDateTime: req.body.preferredDateTime || null,
            nailDesignReference: req.body.nailDesignReference || null,
            gelProductRemovalNeeded: req.body.gelProductRemovalNeeded ?? null,
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