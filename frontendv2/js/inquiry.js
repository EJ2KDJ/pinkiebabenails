const form = document.getElementById('inquiry-form');
const statusMessage = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');
const dateInput = document.getElementById('preferredDate');
const hourInput = document.getElementById('preferredHour');

function localDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function nextAvailableHour() {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
}

function renderHourOptions() {
    const selectedHour = hourInput.value;
    const firstOption = hourInput.options[0];
    hourInput.replaceChildren(firstOption);
    const selectedDate = dateInput.value;
    const earliest = nextAvailableHour();
    const firstHour = selectedDate === localDateValue(earliest) ? earliest.getHours() : 0;

    for (let hour = firstHour; hour < 24; hour += 1) {
        const option = document.createElement('option');
        option.value = String(hour).padStart(2, '0');
        option.textContent = new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true,
        });
        hourInput.appendChild(option);
    }

    hourInput.value = selectedHour;
}

function setMinimumDate() {
    dateInput.min = localDateValue(nextAvailableHour());
    renderHourOptions();
}

dateInput.addEventListener('change', renderHourOptions);
setMinimumDate();

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status form-status-' + type;
}

// Convert the form's local date/time into an ISO timestamp before sending it to the API.
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
        // The date and selected whole hour are local time; convert them to the stored ISO timestamp.
        preferredDateTime: dateInput.value && hourInput.value
            ? new Date(`${dateInput.value}T${hourInput.value}:00`).toISOString()
            : '',
        nailDesignReference: data.get('nailDesignReference'),
        gelProductRemovalNeeded: data.get('gelProductRemovalNeeded') === 'yes',
        website: data.get('website'),
    };

    try {
        // The API validates and stores the inquiry; the response controls the user-facing status.
        const response = await fetch('/api/inquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));

        if (response.ok) {
            form.reset();
            setMinimumDate();
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