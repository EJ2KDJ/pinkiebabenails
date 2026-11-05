require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const path = require('path');

const db = require('./src/models');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/inquiries', require('./src/routes/inquiries'));

// Export for Vercel and other hosting platforms.
module.exports = app;

// Start a local server during development.
if (require.main === module) {
    app.use(express.static(path.resolve(__dirname, '..', 'frontendv2')));

    const PORT = process.env.PORT || 3000;

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