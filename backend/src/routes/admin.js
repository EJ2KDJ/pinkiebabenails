const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../models');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'done'];

// Everything in this file is for the owner only, and must never be cached.
router.use(requireAdmin);
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

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