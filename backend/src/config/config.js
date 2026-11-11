const pg = require('pg');
require('dotenv').config();
// Both environments use the hosted PostgreSQL URL supplied outside source control.
const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectModule: pg,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false, // Avoid logging SQL statements, which can expose submitted data.
};

module.exports = { development: base, production: base };