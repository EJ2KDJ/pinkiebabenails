function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function renderSection(section) {
    const paragraphs = (section.paragraphs || [])
        .map((paragraph) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;overflow-wrap:anywhere;">${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
    const items = (section.items || [])
        .map((item) => `
            <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e8cbd3;">
                    <strong style="display:block;margin-bottom:3px;color:#70203d;font-size:16px;">${escapeHtml(item.label)}</strong>
                    <span style="display:block;color:#40202b;font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(item.value).replace(/\r?\n/g, '<br>')}</span>
                </td>
            </tr>`)
        .join('');
    const bullets = section.bullets && section.bullets.length
        ? `<ul style="margin:0;padding:0 0 0 22px;color:#40202b;font-size:16px;line-height:1.6;">${section.bullets.map((item) => `<li style="margin:0 0 8px;overflow-wrap:anywhere;">${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';

    return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #ecc5d1;background:#fff3f6;">
            <tr><td style="padding:16px 18px;">
                <h2 style="margin:0 0 10px;color:#70203d;font-family:Georgia,serif;font-size:20px;line-height:1.3;">${escapeHtml(section.heading)}</h2>
                ${paragraphs}
                ${items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>` : ''}
                ${bullets}
            </td></tr>
        </table>`;
}

function createBrandedEmail({ title, previewText, paragraphs = [], sections = [], actions = [], text }) {
    if (typeof text !== 'string') {
        throw new TypeError('A plain-text email body is required.');
    }

    const paragraphMarkup = paragraphs
        .map((paragraph) => `<p style="margin:0 0 14px;color:#40202b;font-size:16px;line-height:1.65;overflow-wrap:anywhere;">${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
    const sectionMarkup = sections.map(renderSection).join('');
    const actionMarkup = actions
        .map((action) => `
            <p class="email-action" style="margin:18px 0;text-align:center;">
                <a href="${escapeHtml(action.url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:12px 20px;background:#9f163f;color:#fff4f6;font-size:16px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none;overflow-wrap:anywhere;">${escapeHtml(action.label)}</a>
            </p>`)
        .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @media only screen and (max-width: 600px) {
            .email-outer-cell { padding: 14px 8px !important; }
            .email-header-cell { padding: 22px 18px !important; }
            .email-content-cell { padding: 22px 18px !important; }
            .email-footer-cell { padding: 16px 18px !important; }
            .email-action a { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background:#fff1f4;color:#40202b;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText || title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#fff1f4;">
        <tr><td class="email-outer-cell" align="center" style="padding:26px 12px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border:1px solid #ecc5d1;background:#fffafb;">
                <tr><td class="email-header-cell" align="center" style="padding:24px;background:#70203d;color:#fff4f6;">
                    <p style="margin:0;font-family:Georgia,serif;font-size:25px;font-weight:700;line-height:1.3;">PinkieBabe Nails</p>
                    <p style="margin:6px 0 0;color:#ffe7ed;font-size:16px;line-height:1.4;">A little moment for you</p>
                </td></tr>
                <tr><td class="email-content-cell" style="padding:28px 30px;">
                    <p style="margin:0 0 8px;color:#9f163f;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">PinkieBabe Nails update</p>
                    <h1 style="margin:0 0 18px;color:#40202b;font-family:Georgia,serif;font-size:26px;line-height:1.3;overflow-wrap:anywhere;">${escapeHtml(title)}</h1>
                    ${paragraphMarkup}
                    ${sectionMarkup}
                    ${actionMarkup}
                </td></tr>
                <tr><td class="email-footer-cell" align="center" style="border-top:1px solid #ecc5d1;padding:18px 30px;color:#634351;font-size:16px;line-height:1.5;">
                    PinkieBabe Nails
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;

    return { html, text };
}

module.exports = createBrandedEmail;
