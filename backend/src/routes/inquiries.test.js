const assert = require('node:assert/strict');
const express = require('express');
const { after, before, test } = require('node:test');

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:5432/test';

const db = require('../models');
const nodemailer = require('nodemailer');
const originalCreate = db.Inquiry.create;
const originalCreateTransport = nodemailer.createTransport;
const savedInquiries = [];

db.Inquiry.create = async (values) => {
    savedInquiries.push(values);
    return values;
};
nodemailer.createTransport = () => ({ sendMail: async () => ({ accepted: [] }) });

const app = express();
app.use(express.json());
app.use('/api/inquiries', require('./inquiries'));

let server;
let endpoint;

before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    endpoint = `http://127.0.0.1:${server.address().port}/api/inquiries`;
});

after(async () => {
    db.Inquiry.create = originalCreate;
    nodemailer.createTransport = originalCreateTransport;
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await db.sequelize.close();
    if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
    }
});

test('accepts question inquiries and keeps legacy appointment submissions', async (t) => {
    await t.test('saves a question without appointment-only fields', async () => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Customer',
                email: 'test@example.com',
                message: 'A question for the salon.',
            }),
        });

        assert.equal(response.status, 201);
        assert.equal(savedInquiries[0].message, 'A question for the salon.');
        assert.equal(savedInquiries[0].phoneNumber, null);
        assert.equal(savedInquiries[0].service, null);
        assert.equal(savedInquiries[0].gelProductRemovalNeeded, null);
    });

    await t.test('rejects submissions without a message or appointment details', async () => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Customer',
                email: 'test@example.com',
            }),
        });

        assert.equal(response.status, 400);
        assert.equal(savedInquiries.length, 1);
    });

    await t.test('continues to accept legacy appointment inquiries', async () => {
        const preferredDateTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        preferredDateTime.setUTCMinutes(0, 0, 0);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Legacy Customer',
                email: 'legacy@example.com',
                phoneNumber: '+639171234567',
                service: 'Manicure',
                preferredDateTime: preferredDateTime.toISOString(),
                gelProductRemovalNeeded: false,
            }),
        });

        assert.equal(response.status, 201);
        assert.equal(savedInquiries[1].message, null);
        assert.equal(savedInquiries[1].gelProductRemovalNeeded, false);
    });
});
