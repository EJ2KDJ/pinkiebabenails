const bookPage = document.getElementById('book-page');
const loadingMessage = document.getElementById('booking-loading');
const loginPanel = document.getElementById('booking-login');
const bookingContent = document.getElementById('booking-content');
const appointmentTab = document.getElementById('book-appointment-tab');
const myBookingsTab = document.getElementById('my-bookings-tab');
const appointmentPanel = document.getElementById('book-appointment-panel');
const myBookingsPanel = document.getElementById('my-bookings-panel');
const dateInput = document.getElementById('booking-date');
const calendarGrid = document.getElementById('booking-calendar');
const calendarMonth = document.getElementById('calendar-month');
const previousMonthButton = document.getElementById('calendar-previous');
const nextMonthButton = document.getElementById('calendar-next');
const selectedDateHeading = document.getElementById('selected-date-heading');
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
const summaryDate = document.getElementById('summary-date');
const summaryTime = document.getElementById('summary-time');
const summaryService = document.getElementById('summary-service');
const summaryRemoval = document.getElementById('summary-removal');

let selectedTime = '';
let slots = [];
let currentMonth;
let minimumDate = '';
let maximumDate = '';
let availabilityLoading = false;
let availabilityError = '';
let availabilityRequest = 0;
const unavailableDates = new Set();

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

function formatDateKey(value, options = {}) {
    if (!value) return '';
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        ...options,
    });
}

function formatBookingDate(value, endValue) {
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
    if (!endValue) return `${day} at ${time}`;
    const end = new Date(endValue);
    const endDay = end.toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const endTime = end.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
    });
    return endDay === day ? `${day} at ${time}–${endTime}` : `${day} at ${time} – ${endDay} at ${endTime}`;
}

function monthStart(dateKey) {
    const date = new Date(`${dateKey}T00:00:00Z`);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dateKeyFor(date) {
    return date.toISOString().slice(0, 10);
}

function updateSummary() {
    const serviceOption = serviceInput.selectedOptions[0];
    const removalOption = removalInput.selectedOptions[0];
    const selectedSlot = slots.find((slot) => slot.time === selectedTime);
    summaryDate.textContent = dateInput.value
        ? formatDateKey(dateInput.value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : 'Choose a date';
    summaryTime.textContent = selectedSlot
        ? `${formatTime(selectedSlot.time)} – ${formatTime(selectedSlot.endTime)}${selectedSlot.endsNextDay ? ' (next day)' : ''}`
        : 'Choose a time';
    summaryService.textContent = serviceInput.value ? serviceOption.textContent : 'Choose a service';
    summaryRemoval.textContent = removalInput.value ? removalOption.textContent : 'Choose Yes or No';
}

function updateSubmitState() {
    const hasAvailableSelection = selectedTime
        && slots.some((slot) => slot.time === selectedTime && slot.available);
    submitButton.disabled = availabilityLoading
        || !dateInput.value
        || !hasAvailableSelection
        || !serviceInput.value
        || !removalInput.value;
    updateSummary();
}

function renderCalendar() {
    if (!currentMonth) return;

    calendarMonth.textContent = currentMonth.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
    });
    calendarGrid.replaceChildren();

    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth();
    const firstWeekday = currentMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    for (let blank = 0; blank < firstWeekday; blank += 1) {
        const emptyCell = document.createElement('span');
        emptyCell.className = 'booking-calendar-empty';
        emptyCell.setAttribute('aria-hidden', 'true');
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(Date.UTC(year, month, day));
        const dateKey = dateKeyFor(date);
        const button = document.createElement('button');
        const outsideBookingWindow = dateKey < minimumDate || dateKey > maximumDate;
        const knownUnavailable = unavailableDates.has(dateKey);

        button.type = 'button';
        button.className = 'booking-calendar-day';
        button.textContent = String(day);
        button.setAttribute('aria-label', formatDateKey(dateKey, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }));
        button.setAttribute('aria-pressed', String(dateKey === dateInput.value));
        button.disabled = outsideBookingWindow || knownUnavailable;
        if (outsideBookingWindow || knownUnavailable) button.classList.add('is-unavailable');
        if (dateKey === dateInput.value) button.classList.add('is-selected');
        button.addEventListener('click', () => selectDate(dateKey));
        calendarGrid.appendChild(button);
    }

    const firstMonth = monthStart(minimumDate);
    const lastMonth = monthStart(maximumDate);
    previousMonthButton.disabled = currentMonth.getTime() <= firstMonth.getTime();
    nextMonthButton.disabled = currentMonth.getTime() >= lastMonth.getTime();
}

function renderSlots() {
    const focusedTime = document.activeElement && document.activeElement.dataset.time;
    slotsList.replaceChildren();

    if (availabilityLoading) {
        showStatus(availabilityStatus, 'Loading available times…', '');
    } else if (availabilityError) {
        showStatus(availabilityStatus, availabilityError, 'error');
    } else if (!slots.some((slot) => slot.available)) {
        showStatus(availabilityStatus, 'No available times for this date. Please choose another date.', '');
    } else {
        showStatus(availabilityStatus, '', '');
        slots.forEach((slot) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'booking-slot';
            button.textContent = `${formatTime(slot.time)} – ${formatTime(slot.endTime)}${slot.endsNextDay ? ' (+1 day)' : ''}`;
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
    }

    if (focusedTime) {
        const replacement = [...slotsList.querySelectorAll('button')]
            .find((button) => button.dataset.time === focusedTime && !button.disabled);
        if (replacement) replacement.focus();
    }
    updateSubmitState();
}

async function loadAvailability() {
    if (!dateInput.value) return;

    const requestedDate = dateInput.value;
    const requestId = ++availabilityRequest;
    availabilityLoading = true;
    availabilityError = '';
    renderSlots();

    try {
        const data = await api(`/api/bookings/availability?date=${encodeURIComponent(requestedDate)}`);
        if (requestId !== availabilityRequest || dateInput.value !== requestedDate) return;

        slots = data.slots;
        if (slots.some((slot) => slot.available)) {
            unavailableDates.delete(requestedDate);
        } else {
            unavailableDates.add(requestedDate);
        }
        if (selectedTime && !slots.some((slot) => slot.time === selectedTime && slot.available)) {
            selectedTime = '';
            showStatus(bookingStatus, 'That time is no longer available. Please choose another time.', 'error');
        }
        availabilityLoading = false;
        renderCalendar();
        renderSlots();
    } catch (error) {
        if (requestId !== availabilityRequest || dateInput.value !== requestedDate) return;
        slots = [];
        availabilityLoading = false;
        availabilityError = `Could not load available times. ${error.message}`;
        renderSlots();
    }
}

function selectDate(dateKey) {
    if (dateKey < minimumDate || dateKey > maximumDate || unavailableDates.has(dateKey)) return;
    dateInput.value = dateKey;
    selectedTime = '';
    slots = [];
    showStatus(bookingStatus, '', '');
    selectedDateHeading.textContent = formatDateKey(dateKey, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    renderCalendar();
    updateSummary();
    loadAvailability();
}

function changeMonth(offset) {
    currentMonth = new Date(Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() + offset,
        1
    ));
    renderCalendar();
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
            when.textContent = formatBookingDate(booking.startsAt, booking.endsAt);
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

function selectBookingTab(name) {
    const showAppointment = name === 'appointment';
    appointmentTab.setAttribute('aria-selected', String(showAppointment));
    appointmentTab.tabIndex = showAppointment ? 0 : -1;
    appointmentPanel.hidden = !showAppointment;
    myBookingsTab.setAttribute('aria-selected', String(!showAppointment));
    myBookingsTab.tabIndex = showAppointment ? -1 : 0;
    myBookingsPanel.hidden = showAppointment;
}

appointmentTab.addEventListener('click', () => selectBookingTab('appointment'));
myBookingsTab.addEventListener('click', () => selectBookingTab('bookings'));
document.querySelector('.booking-tabs').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextTab = event.target === appointmentTab ? myBookingsTab : appointmentTab;
    selectBookingTab(nextTab === appointmentTab ? 'appointment' : 'bookings');
    nextTab.focus();
});
selectBookingTab('appointment');

previousMonthButton.addEventListener('click', () => changeMonth(-1));
nextMonthButton.addEventListener('click', () => changeMonth(1));
serviceInput.addEventListener('change', updateSubmitState);
removalInput.addEventListener('change', updateSubmitState);

bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTime || !slots.some((slot) => slot.time === selectedTime && slot.available)) return;

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
                minimumDate = manilaDateKey();
                maximumDate = manilaDateKey(60);
                dateInput.value = minimumDate;
                currentMonth = monthStart(minimumDate);
                selectedDateHeading.textContent = formatDateKey(minimumDate, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                });
                renderCalendar();
                updateSummary();
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
