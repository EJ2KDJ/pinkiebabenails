require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const path = require('path');

const db = require('./src/models');

const app = express();
// Use the hosting proxy's client IP so rate limits work correctly in production.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Lightweight endpoint for deployment health checks.
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Keep inquiry handling in its own router, separate from server setup.
app.use('/api/inquiries', require('./src/routes/inquiries'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));

// Export for Vercel and other hosting platforms.
module.exports = app;

// Start a local server during development.
if (require.main === module) {
    // Serve the static site only for local development; production imports this app.
    app.use(express.static(path.resolve(__dirname, '..', 'frontendv2')));

    const PORT = process.env.PORT || 3000;

    // Start listening only after Sequelize confirms the database is reachable.
    db.sequelize
        .authenticate()
        .then(() => {
            console.log('Database connection established.');

            app.listen(PORT, () => {
                console.log(`Server running at http://localhost:${PORT}`);
            });
        })
        .catch((error) => {
            console.error('Database connection failed:', error.message);
            process.exit(1);
        });
}