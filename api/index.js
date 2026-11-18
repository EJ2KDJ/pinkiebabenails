// Reuse the Express app as the serverless handler for Vercel API requests.
const app = require('../backend/server');

module.exports = app;