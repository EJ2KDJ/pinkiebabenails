const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../models');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'done'];

function validDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Everything in this file is for the owner only, and must never be cached.
router.use(requireAdmin);
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

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