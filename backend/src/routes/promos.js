const express = require('express');
const router = express.Router();

// Placeholder response until promotional offers are configured.
// The homepage hides its promotion area when this array is empty.
router.get('/', (_req, res) => {
    res.json({ promos: [] });
});

module.exports = router;
