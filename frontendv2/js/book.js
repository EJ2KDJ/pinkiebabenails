const bookPage = document.getElementById('book-page');
const loadingMessage = document.getElementById('booking-loading');
const loginPanel = document.getElementById('booking-login');
const bookingContent = document.getElementById('booking-content');
const dateInput = document.getElementById('booking-date');
const slotsList = document.getElementById('booking-slots');
const availabilityStatus = document.getElementById('availability-status');
const bookingForm = document.getElementById('booking-form');
const serviceInput = document.getElementById('booking-service');
const notesInput = document.getElementById('booking-notes');
const removalInput = document.getElementById('gel-removal');
const submitButton = document.getElementById('booking-submit');
const bookingStatus = document.getElementById('booking-status');
const customerBookingList = document.getElementById('customer-booking-list');
const loginText = document.getElementById('booking-login-heading');

let selectedTime = '';
let slots = [];

function manilaDateKey(offset = 0) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day) + offset
    )).toISOString().slice(0, 10);
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'form-status' + (type ? ` form-status-${type}` : '');
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        credentials: 'same-origin',
        headers: {
            ...window.authSessionHeaders(),
            ...(options.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error((data.errors || ['Something went wrong. Please try again.']).join(' '));
        error.status = response.status;
        throw error;
    }
    return data;
}

function formatTime(value) {
    const [hour, minute] = value.split(':').map(Number);
    return new Date(Date.UTC(2020, 0, 1, hour, minute)).toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatBookingDate(value) {
    const date = new Date(value);
    const day = date.toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const time = date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${day} at ${time}`;
}

function updateSubmitState() {
    submitButton.disabled = !selectedTime
        || !serviceInput.value
        || !removalInput.value
        || !dateInput.value;
}

function renderSlots() {
    const focusedTime = document.activeElement && document.activeElement.dataset.time;
    slotsList.replaceChildren();

    slots.forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'booking-slot';
        button.textContent = formatTime(slot.time);
        button.disabled = !slot.available;
        button.dataset.time = slot.time;
        button.setAttribute('aria-pressed', String(slot.time === selectedTime));
        if (slot.time === selectedTime) button.classList.add('is-selected');
        button.addEventListener('click', () => {
            selectedTime = slot.time;
            renderSlots();
            updateSubmitState();
            const selectedButton = [...slotsList.querySelectorAll('button')]
                .find((item) => item.dataset.time === selectedTime);
            if (selectedButton) selectedButton.focus();
        });
        slotsList.appendChild(button);
    });

    if (focusedTime) {
        const replacement = [...slotsList.querySelectorAll('button')]
            .find((button) => button.dataset.time === focusedTime && !button.disabled);
        if (replacement) replacement.focus();
    }

    if (slots.length > 0 && !slots.some((slot) => slot.available)) {
        showStatus(availabilityStatus, 'No available times for this date. Please choose another date.', '');
    } else {
        showStatus(availabilityStatus, '', '');
    }
    updateSubmitState();
}

async function loadAvailability() {
    if (!dateInput.value) return;
    try {
        const data = await api(`/api/bookings/availability?date=${encodeURIComponent(dateInput.value)}`);
        const wasSelected = selectedTime;
        slots = data.slots;
        if (selectedTime && !slots.some((slot) => slot.time === selectedTime && slot.available)) {
            selectedTime = '';
            if (wasSelected) {
                showStatus(bookingStatus, 'That time is no longer available. Please choose another time.', 'error');
            }
        }
        renderSlots();
    } catch (error) {
        showStatus(availabilityStatus, `Could not load available times. ${error.message}`, 'error');
    }
}

async function loadCustomerBookings() {
    try {
        const data = await api('/api/bookings/mine');
        customerBookingList.replaceChildren();
        if (data.bookings.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'You have not sent any booking requests yet.';
            customerBookingList.appendChild(empty);
            return;
        }

        data.bookings.forEach((booking) => {
            const card = document.createElement('article');
            card.className = 'customer-booking-card';
            const heading = document.createElement('h3');
            heading.textContent = booking.service;
            card.appendChild(heading);
            const when = document.createElement('p');
            when.textContent = formatBookingDate(booking.startsAt);
            card.appendChild(when);
            const status = document.createElement('span');
            status.className = `customer-booking-status customer-status-${booking.status}`;
            status.textContent = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
            card.appendChild(status);
            customerBookingList.appendChild(card);
        });
    } catch (error) {
        showStatus(bookingStatus, `Could not load your bookings. ${error.message}`, 'error');
    }
}

dateInput.addEventListener('change', () => {
    selectedTime = '';
    showStatus(bookingStatus, '', '');
    slots = [];
    renderSlots();
    loadAvailability();
});

serviceInput.addEventListener('change', updateSubmitState);
removalInput.addEventListener('change', updateSubmitState);

bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTime) return;

    submitButton.disabled = true;
    showStatus(bookingStatus, '', '');
    try {
        await api('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: dateInput.value,
                time: selectedTime,
                service: serviceInput.value,
                nailDesignReference: notesInput.value.trim(),
                gelProductRemovalNeeded: removalInput.value === 'true',
            }),
        });
        selectedTime = '';
        renderSlots();
        showStatus(bookingStatus, 'Request sent. The owner will email you.', 'success');
        await loadCustomerBookings();
        await loadAvailability();
    } catch (error) {
        if (error.status === 409) {
            selectedTime = '';
            showStatus(bookingStatus, 'Sorry, that time was just taken.', 'error');
            await loadAvailability();
        } else {
            showStatus(bookingStatus, error.message, 'error');
        }
    } finally {
        updateSubmitState();
    }
});

async function start() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: window.authSessionHeaders(),
            credentials: 'same-origin',
        });
        if (response.status === 401) {
            loginPanel.hidden = false;
        } else if (!response.ok) {
            throw new Error('Unable to check your sign-in status. Please try again.');
        } else {
            const data = await response.json();
            if (data.user.role !== 'customer') {
                loginText.textContent = 'Please use a customer account to book';
                loginPanel.hidden = false;
            } else {
                bookingContent.hidden = false;
                dateInput.min = manilaDateKey();
                dateInput.max = manilaDateKey(60);
                dateInput.value = dateInput.min;
                await Promise.all([loadAvailability(), loadCustomerBookings()]);
                window.setInterval(loadAvailability, 30_000);
                window.addEventListener('focus', loadAvailability);
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') loadAvailability();
                });
            }
        }
        bookPage.hidden = false;
        loadingMessage.hidden = true;
    } catch (error) {
        loadingMessage.textContent = error.message;
    }
}

start();
