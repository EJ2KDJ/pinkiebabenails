const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../models');
const { requireAdmin } = require('../../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'done'];
const BOOKING_STATUSES = ['pending', 'accepted', 'declined'];
const ACCEPTED_BOOKING_INDEX = 'bookings_accepted_starts_at_unique';

function validDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatBookingTime(startsAt) {
    return new Date(startsAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'short',
    });
}

function isAcceptedBookingConflict(error) {
    const constraint = (error.original && error.original.constraint)
        || (error.parent && error.parent.constraint);
    return error.name === 'SequelizeUniqueConstraintError' && constraint === ACCEPTED_BOOKING_INDEX;
}

async function sendBookingDecisionEmail(booking, user) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !OWNER_EMAIL) {
        console.warn('Booking decision email not sent: SMTP settings are missing in .env.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const when = formatBookingTime(booking.startsAt);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const policiesUrl = new URL('/contact.html#downpayment-policies', frontendUrl).toString();

    const acceptedText = [
        `Hi ${user.name},`,
        '',
        `Your booking request has been accepted.`,
        `Service: ${booking.service}`,
        `Date and time: ${when}`,
        '',
        'Please message us on Facebook or Instagram to arrange your downpayment:',
        'Facebook: https://www.facebook.com/pinkiebabe1202',
        'Instagram: https://www.instagram.com/pinkiebabe3/',
        '',
        'The Downpayment & appointment policies say:',
        'Soft gel extensions: ₱300.',
        'Gel manicure: ₱200.',
        '“The downpayment is deducted from your total and is non-refundable.”',
        '“Pay through the GCash account provided by the owner, then send a screenshot of your proof of payment.”',
        '“No downpayment, no secured slot. Wait for confirmation that your payment and appointment slot are confirmed.”',
        '',
        `Read the full policies: ${policiesUrl}`,
        '',
        'Your appointment time is accepted, but the slot is secured only after the downpayment is confirmed.',
    ].join('\n');
    const declinedText = [
        `Hi ${user.name},`,
        '',
        `We’re sorry, but we can’t accept your booking request for ${when}.`,
        'Please choose another available time and send us a new request. We hope to see you soon!',
    ].join('\n');

    await transporter.sendMail({
        from: SMTP_USER,
        to: user.email,
        replyTo: OWNER_EMAIL,
        subject: booking.status === 'accepted'
            ? 'Your PinkieBabe Nails booking is accepted'
            : 'Update on your PinkieBabe Nails booking request',
        text: booking.status === 'accepted' ? acceptedText : declinedText,
    });
}

// Everything in this file is for the owner only, and must never be cached.
router.use(requireAdmin);
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

router.get('/bookings', query('status').optional({ values: 'falsy' }).isIn(BOOKING_STATUSES), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: ['Unknown booking status.'] });
    }

    try {
        const where = req.query.status ? { status: req.query.status } : {};
        const bookings = await db.Booking.findAll({
            where,
            include: [{ model: db.User, attributes: ['name', 'phoneNumber', 'email'] }],
            order: [['createdAt', 'DESC']],
            limit: 500,
        });
        return res.json({ bookings });
    } catch (error) {
        console.error('Loading bookings failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

router.patch(
    '/bookings/:id',
    param('id').isInt({ min: 1 }),
    body('status').isIn(['accepted', 'declined']).withMessage('Choose accepted or declined.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: ['Invalid booking update.'] });
        }

        try {
            // The row lock serializes changes to this request; the unique index covers other requests for the same hour.
            const result = await db.sequelize.transaction(async (transaction) => {
                const booking = await db.Booking.findByPk(req.params.id, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!booking) return { error: 'not_found' };
                if (booking.status !== 'pending') return { error: 'not_pending' };

                if (req.body.status === 'accepted') {
                    const existing = await db.Booking.findOne({
                        where: {
                            startsAt: booking.startsAt,
                            status: 'accepted',
                        },
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (existing) return { error: 'time_taken' };
                }

                await booking.update({ status: req.body.status }, { transaction });
                return {
                    booking: {
                        id: booking.id,
                        userId: booking.userId,
                        service: booking.service,
                        startsAt: booking.startsAt,
                        status: booking.status,
                    },
                };
            });

            if (result.error === 'not_found') {
                return res.status(404).json({ errors: ['Booking not found.'] });
            }
            if (result.error === 'not_pending') {
                return res.status(409).json({ errors: ['Only pending bookings can be changed.'] });
            }
            if (result.error === 'time_taken') {
                return res.status(409).json({ errors: ['You already accepted another booking for this time.'] });
            }

            // Email is sent after the status commits, so delivery trouble cannot undo the decision.
            try {
                const user = await db.User.findByPk(result.booking.userId);
                if (!user) {
                    console.error('Booking customer is missing; decision email was not sent.');
                } else {
                    await sendBookingDecisionEmail(result.booking, user);
                }
            } catch (mailError) {
                console.error('Booking decision email failed:', mailError.message);
            }

            return res.json({ booking: result.booking });
        } catch (error) {
            if (isAcceptedBookingConflict(error)) {
                return res.status(409).json({ errors: ['You already accepted another booking for this time.'] });
            }
            console.error('Updating booking failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.get('/settings', async (req, res) => {
    try {
        const settings = await db.Settings.findByPk(1);
        if (!settings) {
            console.error('Salon settings row is missing.');
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
        return res.json({ settings });
    } catch (error) {
        console.error('Loading settings failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

router.put(
    '/settings',
    body('openHour').isInt({ min: 0, max: 23 }).withMessage('Choose a valid opening hour.').toInt(),
    body('closeHour')
        .isInt({ min: 1, max: 24 })
        .withMessage('Choose a valid closing hour.')
        .toInt()
        .custom((closeHour, { req }) => closeHour > Number(req.body.openHour))
        .withMessage('Closing hour must be after opening hour.'),
    body('daysOff')
        .isArray()
        .withMessage('Days off must be a list of dates.')
        .bail()
        .custom((daysOff) => new Set(daysOff).size === daysOff.length)
        .withMessage('Each day off can only be listed once.'),
    body('daysOff.*')
        .custom(validDateOnly)
        .withMessage('Enter each day off as a valid date.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map((error) => error.msg) });
        }

        try {
            const settings = await db.Settings.findByPk(1);
            if (!settings) {
                console.error('Salon settings row is missing.');
                return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
            }

            await settings.update({
                openHour: req.body.openHour,
                closeHour: req.body.closeHour,
                daysOff: req.body.daysOff,
            });
            return res.json({ settings });
        } catch (error) {
            console.error('Saving settings failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.get('/inquiries', query('status').optional().isIn(STATUSES), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: ['Unknown status.'] });
    }

    try {
        const where = req.query.status ? { status: req.query.status } : {};
        const inquiries = await db.Inquiry.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 500,
        });
        return res.json({ inquiries });
    } catch (error) {
        console.error('Loading inquiries failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

router.patch(
    '/inquiries/:id',
    param('id').isInt({ min: 1 }),
    body('status').isIn(STATUSES).withMessage('Unknown status.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: ['Invalid request.'] });
        }

        try {
            const inquiry = await db.Inquiry.findByPk(req.params.id);
            if (!inquiry) {
                return res.status(404).json({ errors: ['Inquiry not found.'] });
            }
            await inquiry.update({ status: req.body.status });
            return res.json({ inquiry });
        } catch (error) {
            console.error('Updating inquiry failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.delete(
    '/inquiries/:id',
    param('id').isInt({ min: 1 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: ['Invalid request.'] });
        }

        try {
            const inquiry = await db.Inquiry.findByPk(req.params.id);
            if (!inquiry) {
                return res.status(404).json({ errors: ['Inquiry not found.'] });
            }
            await inquiry.destroy();
            return res.json({ message: 'Inquiry deleted.' });
        } catch (error) {
            console.error('Deleting inquiry failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

module.exports = router;