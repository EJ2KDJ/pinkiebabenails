const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

const db = require('../models');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
const SERVICES = [
    'Soft gel extensions',
    'Gel manicure',
    'Manicure',
    'Pedicure',
    'Other',
];
const MANILA_UTC_OFFSET_HOURS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function manilaDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function isValidBookingDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const requested = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(requested.getTime()) || requested.toISOString().slice(0, 10) !== value) {
        return false;
    }

    const today = manilaDateKey(new Date());
    const todayUtc = Date.parse(`${today}T00:00:00.000Z`);
    const daysAhead = (requested.getTime() - todayUtc) / DAY_MS;
    return daysAhead >= 0 && daysAhead <= 60;
}

function manilaTimeToUtc(date, hour) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour - MANILA_UTC_OFFSET_HOURS));
}

function formatLocalDateTime(startsAt) {
    return new Date(startsAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'short',
    });
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

    await transporter.sendMail({
        from: SMTP_USER,
        to: OWNER_EMAIL,
        replyTo: user.email,
        subject: 'New booking request',
        text: [
            'New booking request',
            `Name: ${user.name}`,
            `Email: ${user.email}`,
            `Phone: ${user.phoneNumber}`,
            `Service: ${booking.service}`,
            `Date and time: ${formatLocalDateTime(booking.startsAt)}`,
            `Nail design or reference: ${booking.nailDesignReference || '(none)'}`,
            `Gel/product removal needed: ${booking.gelProductRemovalNeeded ? 'Yes' : 'No'}`,
        ].join('\n'),
    });
}

router.get(
    '/availability',
    availabilityLimiter,
    query('date')
        .custom(isValidBookingDate)
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

            const dayStart = manilaTimeToUtc(req.query.date, 0);
            const dayEnd = new Date(dayStart.getTime() + DAY_MS);
            const accepted = await db.Booking.findAll({
                attributes: ['startsAt'],
                where: {
                    status: 'accepted',
                    startsAt: {
                        [db.Sequelize.Op.gte]: dayStart,
                        [db.Sequelize.Op.lt]: dayEnd,
                    },
                },
            });
            const acceptedTimes = new Set(accepted.map((booking) => new Date(booking.startsAt).getTime()));
            const now = Date.now();
            const isDayOff = settings.daysOff.includes(req.query.date);
            const slots = [];

            for (let hour = settings.openHour; hour < settings.closeHour; hour += 1) {
                const startsAt = manilaTimeToUtc(req.query.date, hour);
                slots.push({
                    time: `${String(hour).padStart(2, '0')}:00`,
                    available: !isDayOff
                        && startsAt.getTime() > now
                        && !acceptedTimes.has(startsAt.getTime()),
                });
            }

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
        .custom(isValidBookingDate)
        .withMessage('Choose a valid date from today through 60 days from now.'),
    body('time')
        .matches(/^(?:[01]\d|2[0-3]):00$/)
        .withMessage('Choose an appointment time on the hour.'),
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
            const hour = Number(req.body.time.slice(0, 2));
            const startsAt = manilaTimeToUtc(req.body.date, hour);
            if (startsAt.getTime() <= Date.now()) {
                return res.status(400).json({ errors: ['Choose an appointment time in the future.'] });
            }

            // Serialize new requests with owner acceptance so an in-flight acceptance cannot race this check.
            const result = await db.sequelize.transaction(async (transaction) => {
                const settings = await db.Settings.findByPk(1, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!settings) return { error: 'settings_missing' };
                if (hour < settings.openHour || hour >= settings.closeHour) {
                    return { error: 'outside_hours' };
                }
                if (settings.daysOff.includes(req.body.date)) {
                    return { error: 'day_off' };
                }

                const acceptedBooking = await db.Booking.findOne({
                    where: { startsAt, status: 'accepted' },
                    transaction,
                });
                if (acceptedBooking) return { error: 'time_taken' };

                const booking = await db.Booking.create({
                    userId: req.bookingUser.id,
                    service: req.body.service,
                    startsAt,
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
            if (result.error === 'outside_hours') {
                return res.status(400).json({ errors: ['That time is outside opening hours.'] });
            }
            if (result.error === 'day_off') {
                return res.status(400).json({ errors: ['The salon is closed on that date.'] });
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
