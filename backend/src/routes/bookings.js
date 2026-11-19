const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

const db = require('../models');
const { requireAuth } = require('../../middleware/auth');
const createBrandedEmail = require('../utils/branded-email');
const {
    getAvailabilitySlots,
    getIntervalsForDate,
    isWithinBookingWindow,
    makeInterval,
    timeMinutes,
} = require('../utils/booking-availability');

const router = express.Router();
const SERVICES = [
    'Soft gel extensions',
    'Gel manicure',
    'Manicure',
    'Pedicure',
    'Other',
];
const availabilityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many availability checks. Please try again later.'] },
});
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: ['Too many booking requests. Please try again later.'] },
});

async function requireCustomer(req, res, next) {
    try {
        const user = await db.User.findByPk(req.user.id);
        if (!user) {
            return res.status(401).json({ errors: ['Please log in.'] });
        }
        if (user.role !== 'customer') {
            return res.status(403).json({ errors: ['Only customer accounts can manage bookings.'] });
        }
        req.bookingUser = user;
        return next();
    } catch (error) {
        console.error('Booking account check failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
}

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

function formatLocalDateTime(startsAt, endsAt) {
    const start = new Date(startsAt);
    const date = start.toLocaleDateString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
    });
    const startTime = start.toLocaleTimeString('en-PH', {
        timeZone: 'Asia/Manila',
        timeStyle: 'short',
    });
    const end = new Date(endsAt);
    const endDate = end.toLocaleDateString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
    });
    const endTime = end.toLocaleTimeString('en-PH', {
        timeZone: 'Asia/Manila',
        timeStyle: 'short',
    });
    return endDate === date
        ? `${date}, ${startTime}–${endTime}`
        : `${date}, ${startTime} – ${endDate}, ${endTime}`;
}

async function sendOwnerEmail(booking, user) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !OWNER_EMAIL) {
        console.warn('Booking email not sent: SMTP settings are missing in .env.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const when = formatLocalDateTime(booking.startsAt, booking.endsAt);

    const email = createBrandedEmail({
        title: 'New booking request',
        previewText: `New appointment request from ${user.name}`,
        paragraphs: ['A customer has sent a new appointment request.'],
        sections: [
            {
                heading: 'Customer details',
                items: [
                    { label: 'Name', value: user.name },
                    { label: 'Email', value: user.email },
                    { label: 'Phone', value: user.phoneNumber },
                ],
            },
            {
                heading: 'Appointment details',
                items: [
                    { label: 'Service', value: booking.service },
                    { label: 'Date and time', value: when },
                    { label: 'Nail design or reference', value: booking.nailDesignReference || '(none)' },
                    { label: 'Gel/product removal needed', value: booking.gelProductRemovalNeeded ? 'Yes' : 'No' },
                ],
            },
        ],
        text: [
            'New booking request',
            `Name: ${user.name}`,
            `Email: ${user.email}`,
            `Phone: ${user.phoneNumber}`,
            `Service: ${booking.service}`,
            `Date and time: ${when}`,
            `Nail design or reference: ${booking.nailDesignReference || '(none)'}`,
            `Gel/product removal needed: ${booking.gelProductRemovalNeeded ? 'Yes' : 'No'}`,
        ].join('\n'),
    });

    await transporter.sendMail({
        from: SMTP_USER,
        to: OWNER_EMAIL,
        replyTo: user.email,
        subject: 'New booking request',
        ...email,
    });
}

router.get(
    '/availability',
    availabilityLimiter,
    query('date')
        .custom((value) => isWithinBookingWindow(value))
        .withMessage('Choose a valid date from today through 60 days from now.'),
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

            const dayStart = makeInterval(req.query.date, '00:00', '00:01').startsAt;
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            const accepted = await db.Booking.findAll({
                attributes: ['startsAt', 'endsAt'],
                where: {
                    status: 'accepted',
                    startsAt: {
                        [db.Sequelize.Op.gte]: new Date(dayStart.getTime() - 24 * 60 * 60 * 1000),
                        [db.Sequelize.Op.lt]: new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000),
                    },
                },
            });
            const slots = getAvailabilitySlots(settings, req.query.date, accepted);
            return res.json({ date: req.query.date, slots });
        } catch (error) {
            console.error('Loading booking availability failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.post(
    '/',
    requireAuth,
    requireCustomer,
    bookingLimiter,
    body('date')
        .custom((value) => isWithinBookingWindow(value))
        .withMessage('Choose a valid date from today through 60 days from now.'),
    body('time')
        .custom((value) => timeMinutes(value) !== null)
        .withMessage('Choose a valid appointment time.'),
    body('service').isIn(SERVICES).withMessage('Please choose a service.'),
    body('nailDesignReference')
        .optional({ values: 'null' })
        .isString()
        .withMessage('Enter design notes as text.')
        .bail()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Design notes must be 1000 characters or fewer.'),
    body('gelProductRemovalNeeded')
        .isBoolean()
        .withMessage('Please choose Yes or No.')
        .toBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map((error) => error.msg) });
        }

        try {
            // Serialize new requests with owner acceptance so an in-flight acceptance cannot race this check.
            const result = await db.sequelize.transaction(async (transaction) => {
                const settings = await db.Settings.findByPk(1, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!settings) return { error: 'settings_missing' };
                if (settings.daysOff.includes(req.body.date)) {
                    return { error: 'day_off' };
                }

                const slot = getIntervalsForDate(settings, req.body.date)
                    .find((item) => item.startTime === req.body.time);
                if (!slot) return { error: 'time_taken' };
                if (slot.startsAt.getTime() <= Date.now()) {
                    return { error: 'past_time' };
                }

                const acceptedBookings = await db.Booking.findAll({
                    attributes: ['startsAt', 'endsAt'],
                    where: {
                        status: 'accepted',
                        startsAt: {
                            [db.Sequelize.Op.gte]: new Date(slot.startsAt.getTime() - 24 * 60 * 60 * 1000),
                            [db.Sequelize.Op.lt]: slot.endsAt,
                        },
                    },
                    transaction,
                });
                const overlapsAcceptedBooking = acceptedBookings.some((booking) => (
                    new Date(booking.startsAt) < slot.endsAt
                    && new Date(booking.endsAt) > slot.startsAt
                ));
                if (overlapsAcceptedBooking) return { error: 'time_taken' };

                const booking = await db.Booking.create({
                    userId: req.bookingUser.id,
                    service: req.body.service,
                    startsAt: slot.startsAt,
                    endsAt: slot.endsAt,
                    nailDesignReference: req.body.nailDesignReference || null,
                    gelProductRemovalNeeded: req.body.gelProductRemovalNeeded,
                    status: 'pending',
                }, { transaction });
                return { booking };
            });

            if (result.error === 'settings_missing') {
                console.error('Salon settings row is missing.');
                return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
            }
            if (result.error === 'day_off') {
                return res.status(400).json({ errors: ['The salon is closed on that date.'] });
            }
            if (result.error === 'past_time') {
                return res.status(400).json({ errors: ['Choose an appointment time in the future.'] });
            }
            if (result.error === 'time_taken') {
                return res.status(409).json({ errors: ['That time is no longer available.'] });
            }

            try {
                await sendOwnerEmail(result.booking, req.bookingUser);
            } catch (mailError) {
                console.error('New booking email failed:', mailError.message);
            }

            return res.status(201).json({ message: 'Booking request sent.', booking: result.booking });
        } catch (error) {
            console.error('Creating booking failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    }
);

router.get('/mine', requireAuth, requireCustomer, async (req, res) => {
    try {
        const bookings = await db.Booking.findAll({
            where: { userId: req.bookingUser.id },
            order: [['createdAt', 'DESC']],
        });
        return res.json({ bookings });
    } catch (error) {
        console.error('Loading customer bookings failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
});

module.exports = router;
