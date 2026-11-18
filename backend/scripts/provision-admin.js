require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/models');

async function provisionAdmin() {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    const name = (process.env.ADMIN_NAME || 'Salon Owner').trim();
    const phoneNumber = (process.env.ADMIN_PHONE_NUMBER || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Set ADMIN_EMAIL to a valid email address.');
    }
    if (password.length < 8 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('ADMIN_PASSWORD must be between 8 and 72 characters and no more than 72 bytes.');
    }

    await db.sequelize.authenticate();
    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await db.User.findOne({ where: { email } });

    if (existingUser) {
        await existingUser.update({
            name,
            phoneNumber,
            passwordHash,
            role: 'admin',
            resetPasswordTokenHash: null,
            resetPasswordExpiresAt: null,
        });
        console.log(`Updated owner account for ${email}.`);
        return;
    }

    await db.User.create({
        name,
        email,
        phoneNumber,
        passwordHash,
        role: 'admin',
    });
    console.log(`Created owner account for ${email}.`);
}

provisionAdmin()
    .catch((error) => {
        console.error('Owner account provisioning failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.sequelize.close();
    });
