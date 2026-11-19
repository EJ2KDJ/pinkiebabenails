const form = document.getElementById('inquiry-form');
const statusMessage = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');

function showStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status' + (type ? ` form-status-${type}` : '');
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus();
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    const data = new FormData(form);
    const payload = {
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        website: data.get('website'),
    };

    try {
        const response = await fetch('/api/inquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));

        if (response.ok) {
            form.reset();
            showStatus('Thank you! Your question was sent. We will get back to you by email.', 'success');
        } else {
            showStatus((result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
        }
    } catch (error) {
        showStatus('Could not reach the server. Please check your connection and try again.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send question';
    }
});
