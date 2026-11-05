const form = document.getElementById('inquiry-form');
const statusMessage = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');
const dateTimeInput = form.elements.preferredDateTime;

// Do not let people pick a time that has already passed.
function setMinimumDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateTimeInput.min = now.toISOString().slice(0, 16);
}
setMinimumDateTime();

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status form-status-' + type;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus('', '');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    const data = new FormData(form);
    const payload = {
        name: data.get('name'),
        email: data.get('email'),
        phoneNumber: data.get('phoneNumber'),
        service: data.get('service'),
        // new Date(...) reads the picked time as the visitor's local time (Manila),
        // and toISOString() converts it so the server stores the correct moment.
        preferredDateTime: dateTimeInput.value ? new Date(dateTimeInput.value).toISOString() : '',
        nailDesignReference: data.get('nailDesignReference'),
        gelProductRemovalNeeded: data.get('gelProductRemovalNeeded') === 'yes',
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
            setMinimumDateTime();
            showStatus('Thank you! Your inquiry was sent. We will message you to confirm availability.', 'success');
        } else {
            showStatus((result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
        }
    } catch (error) {
        showStatus('Could not reach the server. Please check your connection and try again.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send inquiry';
    }
});