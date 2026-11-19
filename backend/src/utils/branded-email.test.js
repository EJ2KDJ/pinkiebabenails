const assert = require('node:assert/strict');
const test = require('node:test');

const createBrandedEmail = require('./branded-email');

test('creates a responsive branded HTML email and preserves its plain-text fallback', () => {
    const text = 'Reset your password:\n\nhttps://example.com/reset?a=1&b=2';
    const email = createBrandedEmail({
        title: 'Reset <password>',
        previewText: 'A new reset & link',
        paragraphs: ['We\u2019re happy to help.\nUse the link below.'],
        sections: [{
            heading: 'Account details',
            items: [{ label: 'Customer', value: 'A <Customer>\nAccount owner \u20b1300' }],
        }],
        actions: [{ label: 'Reset & continue', url: 'https://example.com/reset?a=1&b=2' }],
        text,
    });

    assert.equal(email.text, text);
    assert.match(email.html, /name="viewport"/);
    assert.match(email.html, /max-width:600px/);
    assert.match(email.html, /font-size:16px/);
    assert.match(email.html, /Reset &lt;password&gt;/);
    assert.match(email.html, /We\u2019re happy to help/);
    assert.match(email.html, /A &lt;Customer&gt;<br>Account owner \u20b1300/);
    assert.match(email.html, /href="https:\/\/example\.com\/reset\?a=1&amp;b=2"/);
    assert.doesNotMatch(email.html, /<Customer>|<password>/);
});

test('requires a plain-text fallback', () => {
    assert.throws(() => createBrandedEmail({ title: 'Missing fallback' }), {
        name: 'TypeError',
        message: 'A plain-text email body is required.',
    });
});
