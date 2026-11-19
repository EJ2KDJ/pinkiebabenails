const STATUSES = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'done', label: 'Done' },
];

const dashboard = document.getElementById('dashboard');
const loading = document.getElementById('loading');
const filterBar = document.getElementById('filter-bar');
const list = document.getElementById('inquiry-list');
const statusMessage = document.getElementById('dashboard-status');
const filterType = document.getElementById('inquiry-filter-type');
const filterValue = document.getElementById('inquiry-filter-value');
const serviceValue = document.getElementById('inquiry-service-value');
const resultCount = document.getElementById('inquiry-result-count');
const bookingsTab = document.getElementById('bookings-tab');
const inquiriesTab = document.getElementById('inquiries-tab');
const bookingsPanel = document.getElementById('bookings-panel');
const inquiriesPanel = document.getElementById('inquiries-panel');
const bookingsStatus = document.getElementById('bookings-status');
const bookingTabs = [
    {
        name: 'availability',
        button: document.getElementById('availability-tab'),
        panel: document.getElementById('availability-panel'),
    },
    {
        name: 'pending',
        button: document.getElementById('pending-bookings-tab'),
        panel: document.getElementById('pending-bookings-panel'),
    },
    {
        name: 'decided',
        button: document.getElementById('decided-bookings-tab'),
        panel: document.getElementById('decided-bookings-panel'),
    },
];
const bookingSearch = {
    pending: {
        type: document.getElementById('pending-booking-filter-type'),
        value: document.getElementById('pending-booking-filter-value'),
        service: document.getElementById('pending-booking-service-value'),
        resultCount: document.getElementById('pending-booking-result-count'),
        list: document.getElementById('pending-booking-list'),
    },
    decided: {
        type: document.getElementById('decided-booking-filter-type'),
        value: document.getElementById('decided-booking-filter-value'),
        service: document.getElementById('decided-booking-service-value'),
        resultCount: document.getElementById('decided-booking-result-count'),
        list: document.getElementById('decided-booking-list'),
    },
};
const decidedBookingStatusFilters = document.getElementById('decided-booking-status-filters');
const openHourSelect = document.getElementById('setting-open-hour');
const closeHourSelect = document.getElementById('setting-close-hour');
const daysOffCalendar = document.getElementById('days-off-calendar');
const daysOffSummary = document.getElementById('days-off-summary');
const calendarMonthLabel = document.getElementById('calendar-month');
const settingsStatus = document.getElementById('settings-status');
const selectedAvailabilityDateLabel = document.getElementById('selected-availability-date');
const availabilityMode = document.getElementById('availability-mode');
const dayOffToggle = document.getElementById('setting-day-off');
const availabilitySlotList = document.getElementById('availability-slot-list');
const availabilityEmpty = document.getElementById('availability-empty');
const addAvailabilitySlotButton = document.getElementById('add-availability-slot');
const useDefaultSlotsButton = document.getElementById('use-default-slots');

let inquiries = [];
let currentFilter = 'all';
let lastSnapshot = '';
let bookings = [];
let lastBookingSnapshot = '';
let decidedBookingStatusFilter = 'all';
let daysOff = new Set();
let customSlotsByDate = {};
let calendarMonth = currentManilaMonth();
let selectedAvailabilityDate = '';
let minimumAvailabilityDate = '';
let maximumAvailabilityDate = '';

// Builds an element and sets its text safely. Customer text is never inserted as HTML.
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status' + (type ? ' form-status-' + type : '');
}

function formatDateTime(value) {
    return new Date(value).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

// Talks to the server. A logged-out or non-admin visitor is sent to the owner login page.
async function api(path, options) {
    const response = await fetch(path, {
        ...options,
        headers: {
            ...window.authSessionHeaders(),
            'Content-Type': 'application/json',
            ...(options && options.headers),
        },
    });
    if (response.status === 401 || response.status === 403) {
        window.location.href = 'admin-login.html';
        throw new Error('Not logged in.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error((data.errors || ['Something went wrong. Please try again.']).join(' '));
        error.status = response.status;
        throw error;
    }
    return data;
}

// Turns web links in the customer's design notes into clickable links.
function appendWithLinks(parent, text) {
    text.split(/(https?:\/\/[^\s]+)/g).forEach((part) => {
        if (/^https?:\/\//.test(part)) {
            const link = el('a', 'text-link', part);
            link.href = part;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            parent.appendChild(link);
        } else if (part) {
            parent.appendChild(document.createTextNode(part));
        }
    });
}

function detailRow(dl, label, content) {
    dl.appendChild(el('dt', '', label));
    const dd = el('dd');
    if (typeof content === 'string') {
        dd.textContent = content;
    } else {
        dd.appendChild(content);
    }
    dl.appendChild(dd);
}

function renderFilters() {
    filterBar.replaceChildren();
    const options = [{ value: 'all', label: 'All' }, ...STATUSES];
    options.forEach((option) => {
        const count = option.value === 'all' ? inquiries.length : inquiries.filter((i) => i.status === option.value).length;
        const button = el('button', 'filter-chip', `${option.label} (${count})`);
        button.type = 'button';
        button.setAttribute('aria-pressed', String(option.value === currentFilter));
        button.addEventListener('click', () => {
            currentFilter = option.value;
            render();
        });
        filterBar.appendChild(button);
    });
}

function dateInManila(value) {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(value));
    const date = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    return `${date.year}-${date.month}-${date.day}`;
}

function renderServiceOptions() {
    const selectedService = serviceValue.value;
    serviceValue.replaceChildren(el('option', '', 'All services'));
    serviceValue.firstElementChild.value = '';
    [...new Set(inquiries.map((inquiry) => inquiry.service).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .forEach((service) => {
            const option = el('option', '', service);
            option.value = service;
            serviceValue.appendChild(option);
        });
    serviceValue.value = selectedService;
}

function renderCard(inquiry) {
    const card = el('article', 'inquiry-card');

    const head = el('div', 'inquiry-card-head');
    const who = el('div');
    who.appendChild(el('h2', 'inquiry-name', inquiry.name));
    who.appendChild(el('p', 'inquiry-received', 'Received ' + formatDateTime(inquiry.createdAt)));
    head.appendChild(who);
    const current = STATUSES.find((s) => s.value === inquiry.status);
    head.appendChild(el('span', 'status-badge status-' + inquiry.status, current ? current.label : inquiry.status));
    card.appendChild(head);

    const dl = el('dl', 'inquiry-details');

    if (inquiry.phoneNumber) {
        const phone = el('a', 'text-link', inquiry.phoneNumber);
        phone.href = 'tel:' + inquiry.phoneNumber.replace(/[^0-9+]/g, '');
        detailRow(dl, 'Phone', phone);
    }

    const email = el('a', 'text-link', inquiry.email);
    email.href = 'mailto:' + inquiry.email;
    detailRow(dl, 'Email', email);

    if (inquiry.service) detailRow(dl, 'Service', inquiry.service);
    if (inquiry.preferredDateTime) {
        detailRow(dl, 'Preferred date & time', formatDateTime(inquiry.preferredDateTime));
    }

    const message = inquiry.message || inquiry.nailDesignReference;
    if (message) {
        const note = el('span', 'inquiry-note');
        appendWithLinks(note, message);
        detailRow(dl, inquiry.message ? 'Message' : 'Nail design / reference', note);
    }
    if (inquiry.gelProductRemovalNeeded !== null && inquiry.gelProductRemovalNeeded !== undefined) {
        detailRow(dl, 'Gel/product removal', inquiry.gelProductRemovalNeeded ? 'Yes' : 'No');
    }
    card.appendChild(dl);

    const actions = el('div', 'status-actions');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Set status for ' + inquiry.name);
    STATUSES.forEach((status) => {
        const button = el('button', 'status-button', status.label);
        button.type = 'button';
        button.setAttribute('aria-pressed', String(status.value === inquiry.status));
        button.addEventListener('click', () => changeStatus(inquiry, status.value, actions));
        actions.appendChild(button);
    });
    const deleteButton = el('button', 'delete-inquiry-button', 'Delete inquiry');
    deleteButton.type = 'button';
    deleteButton.addEventListener('click', () => deleteInquiry(inquiry, actions));
    actions.appendChild(deleteButton);
    card.appendChild(actions);

    return card;
}

function render() {
    renderFilters();
    list.replaceChildren();

    const search = filterValue.value.trim().toLocaleLowerCase();
    const visible = inquiries.filter((inquiry) => {
        const matchesStatus = currentFilter === 'all' || inquiry.status === currentFilter;
        const searchField = filterType.value;
        const fieldValue = searchField === 'date'
            ? dateInManila(inquiry.preferredDateTime)
            : String(inquiry[searchField] || '').toLocaleLowerCase();
        const query = searchField === 'service' ? serviceValue.value.toLocaleLowerCase() : search;
        return matchesStatus && (!query || fieldValue.includes(query));
    });

    resultCount.textContent = `Showing ${visible.length} of ${inquiries.length} inquiries`;
    if (visible.length === 0) {
        const message = inquiries.length === 0
            ? 'No inquiries yet. New ones will appear here.'
            : 'No inquiries match the selected filters.';
        list.appendChild(el('p', 'empty-state', message));
        return;
    }
    visible.forEach((inquiry) => list.appendChild(renderCard(inquiry)));
}

function showBookingStatus(message, type) {
    bookingsStatus.textContent = message;
    bookingsStatus.className = 'form-status' + (type ? ' form-status-' + type : '');
}

function showSettingsStatus(message, type) {
    settingsStatus.textContent = message;
    settingsStatus.className = 'form-status' + (type ? ' form-status-' + type : '');
}

function formatBookingWhen(value, includeYear = true, endValue = '') {
    const date = new Date(value);
    const dateOptions = {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    };
    if (includeYear) dateOptions.year = 'numeric';
    const day = date.toLocaleDateString('en-US', dateOptions);
    const time = date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
    });
    if (!endValue) return `${day} at ${time}`;
    const end = new Date(endValue);
    const endDate = end.toLocaleDateString('en-US', dateOptions);
    const endTime = end.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
    });
    return endDate === day ? `${day}, ${time}–${endTime}` : `${day}, ${time} – ${endDate}, ${endTime}`;
}

function renderBookingCard(booking) {
    const customer = booking.User || {};
    const name = customer.name || 'Customer';
    const card = el('article', 'booking-admin-card');
    const header = el('div', 'booking-admin-card-head');
    const nameBlock = el('div');
    nameBlock.appendChild(el('h2', 'booking-customer-name', name));
    nameBlock.appendChild(el('p', 'booking-admin-time', formatBookingWhen(booking.startsAt, true, booking.endsAt)));
    header.appendChild(nameBlock);
    header.appendChild(el(
        'span',
        `booking-admin-status booking-admin-status-${booking.status}`,
        booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
    ));
    card.appendChild(header);

    const details = el('dl', 'booking-admin-details');
    let phone = 'Phone number unavailable';
    if (customer.phoneNumber) {
        phone = el('a', 'text-link', customer.phoneNumber);
        phone.href = `tel:${customer.phoneNumber.replace(/[^0-9+]/g, '')}`;
    }
    detailRow(details, 'Phone', phone);
    if (customer.email) {
        const email = el('a', 'text-link', customer.email);
        email.href = `mailto:${customer.email}`;
        detailRow(details, 'Email', email);
    }
    detailRow(details, 'Service', booking.service);
    card.appendChild(details);

    if (booking.status === 'pending') {
        const actions = el('div', 'booking-admin-actions');
        const accept = el('button', 'booking-action booking-accept', 'Accept');
        accept.type = 'button';
        accept.addEventListener('click', () => changeBookingStatus(booking, 'accepted', actions));
        const decline = el('button', 'booking-action booking-decline', 'Decline');
        decline.type = 'button';
        decline.addEventListener('click', () => changeBookingStatus(booking, 'declined', actions));
        actions.append(accept, decline);
        card.appendChild(actions);
    }

    return card;
}

function bookingStatusesForView(view) {
    return bookings
        .filter((booking) => view === 'pending'
            ? booking.status === 'pending'
            : booking.status === 'accepted' || booking.status === 'declined')
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}

function renderDecidedBookingStatusFilters() {
    const decidedBookings = bookingStatusesForView('decided');
    const options = [
        { value: 'all', label: 'All', count: decidedBookings.length },
        { value: 'accepted', label: 'Accepted', count: decidedBookings.filter((booking) => booking.status === 'accepted').length },
        { value: 'declined', label: 'Declined', count: decidedBookings.filter((booking) => booking.status === 'declined').length },
    ];

    decidedBookingStatusFilters.replaceChildren();
    options.forEach((option) => {
        const button = el('button', 'filter-chip', `${option.label} (${option.count})`);
        button.type = 'button';
        button.dataset.status = option.value;
        button.setAttribute('aria-pressed', String(option.value === decidedBookingStatusFilter));
        button.addEventListener('click', () => {
            decidedBookingStatusFilter = option.value;
            decidedBookingStatusFilters.querySelectorAll('.filter-chip').forEach((filter) => {
                filter.setAttribute('aria-pressed', String(filter.dataset.status === decidedBookingStatusFilter));
            });
            renderBookingView('decided');
        });
        decidedBookingStatusFilters.appendChild(button);
    });
}

function updateBookingServiceOptions(view, viewBookings) {
    const serviceSelect = bookingSearch[view].service;
    const selectedService = serviceSelect.value;
    serviceSelect.replaceChildren(el('option', '', 'All services'));
    serviceSelect.firstElementChild.value = '';
    [...new Set(viewBookings.map((booking) => booking.service).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second))
        .forEach((service) => {
            const option = el('option', '', service);
            option.value = service;
            serviceSelect.appendChild(option);
        });
    serviceSelect.value = selectedService;
}

function bookingMatchesSearch(booking, controls) {
    const searchType = controls.type.value;
    if (searchType === 'service') {
        const service = String(booking.service || '').toLocaleLowerCase();
        const selectedService = controls.service.value.toLocaleLowerCase();
        return !selectedService || service.includes(selectedService);
    }

    if (searchType === 'date') {
        return !controls.value.value || dateInManila(booking.startsAt) === controls.value.value;
    }

    const customer = booking.User || {};
    const fieldValue = searchType === 'email' ? customer.email : customer.name;
    const query = controls.value.value.trim().toLocaleLowerCase();
    return !query || String(fieldValue || '').toLocaleLowerCase().includes(query);
}

function renderBookingView(view) {
    const controls = bookingSearch[view];
    const baseBookings = bookingStatusesForView(view);
    updateBookingServiceOptions(view, baseBookings);
    const statusBookings = view === 'decided' && decidedBookingStatusFilter !== 'all'
        ? baseBookings.filter((booking) => booking.status === decidedBookingStatusFilter)
        : baseBookings;
    const visible = statusBookings.filter((booking) => bookingMatchesSearch(booking, controls));

    controls.list.replaceChildren();
    controls.resultCount.textContent = `Showing ${visible.length} of ${statusBookings.length} bookings`;

    if (visible.length === 0) {
        let message = 'No bookings match the selected filters.';
        if (baseBookings.length === 0) {
            message = view === 'pending'
                ? 'No pending booking requests.'
                : 'No accepted or declined bookings yet.';
        } else if (statusBookings.length === 0) {
            message = `No ${decidedBookingStatusFilter} bookings yet.`;
        }
        controls.list.appendChild(el('p', 'empty-state', message));
        return;
    }

    visible.forEach((booking) => controls.list.appendChild(renderBookingCard(booking)));
}

function renderBookings() {
    renderDecidedBookingStatusFilters();
    renderBookingView('pending');
    renderBookingView('decided');
}

function updateBookingFilterInput(view) {
    const controls = bookingSearch[view];
    const field = controls.type.value;
    const isService = field === 'service';
    controls.value.hidden = isService;
    controls.service.hidden = !isService;
    controls.value.value = '';
    controls.service.value = '';

    if (field === 'date') {
        controls.value.type = 'date';
        controls.value.placeholder = '';
        controls.value.setAttribute('aria-label', 'Appointment date');
    } else {
        controls.value.type = 'search';
        controls.value.placeholder = field === 'email' ? 'Search by email' : 'Search by name';
        controls.value.setAttribute('aria-label', `Search by ${field}`);
    }
    renderBookingView(view);
}

function clearBookingFilters(view) {
    const controls = bookingSearch[view];
    controls.value.value = '';
    controls.service.value = '';
    if (view === 'decided') {
        decidedBookingStatusFilter = 'all';
        renderDecidedBookingStatusFilters();
    }
    renderBookingView(view);
}

async function loadBookings(showDone) {
    try {
        const data = await api('/api/admin/bookings');
        const snapshot = JSON.stringify(data.bookings);
        if (snapshot !== lastBookingSnapshot) {
            bookings = data.bookings;
            lastBookingSnapshot = snapshot;
            renderBookings();
        }
        showBookingStatus(showDone ? 'Bookings are up to date.' : '', 'success');
    } catch (error) {
        if (error.message !== 'Not logged in.') {
            showBookingStatus(`Could not load bookings. ${error.message}`, 'error');
        }
    }
}

async function changeBookingStatus(booking, status, actions) {
    const customerName = booking.User && booking.User.name ? booking.User.name : 'this customer';
    const verb = status === 'accepted' ? 'Accept' : 'Decline';
    if (!window.confirm(`${verb} ${customerName}'s booking for ${formatBookingWhen(booking.startsAt, false, booking.endsAt)}?`)) {
        return;
    }

    actions.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
    });
    showBookingStatus('', '');
    try {
        await api(`/api/admin/bookings/${booking.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        await loadBookings(false);
        showBookingStatus(`Booking ${status}.`, 'success');
    } catch (error) {
        if (error.status === 409 && status === 'accepted') {
            showBookingStatus('This appointment overlaps another accepted booking. Refresh the list and review it.', 'error');
            await loadBookings(false);
            showBookingStatus('This appointment overlaps another accepted booking. Refresh the list and review it.', 'error');
        } else {
            showBookingStatus(error.message, 'error');
            actions.querySelectorAll('button').forEach((button) => {
                button.disabled = false;
            });
        }
    }
}

function currentManilaMonth() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, 1));
}

function currentManilaDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDateDays(dateKey, days) {
    return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
}

function dayOffKey(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateIsManageable(dateKey) {
    return dateKey >= minimumAvailabilityDate && dateKey <= maximumAvailabilityDate;
}

function formattedDayOff(dateKey) {
    return new Date(`${dateKey}T12:00:00.000Z`).toLocaleDateString('en-PH', {
        timeZone: 'UTC',
        dateStyle: 'medium',
    });
}

function defaultSlotsForDate() {
    const slots = [];
    for (let hour = Number(openHourSelect.value); hour < Number(closeHourSelect.value); hour += 1) {
        slots.push({
            startTime: `${String(hour).padStart(2, '0')}:00`,
            endTime: `${String((hour + 1) % 24).padStart(2, '0')}:00`,
        });
    }
    return slots;
}

function ensureCustomSlots(dateKey) {
    if (!Object.prototype.hasOwnProperty.call(customSlotsByDate, dateKey)) {
        customSlotsByDate[dateKey] = daysOff.has(dateKey) ? [] : defaultSlotsForDate();
    }
    return customSlotsByDate[dateKey];
}

function renderAvailabilitySlots() {
    const dateKey = selectedAvailabilityDate;
    if (!dateKey) return;

    selectedAvailabilityDateLabel.textContent = formattedDayOff(dateKey);
    dayOffToggle.checked = daysOff.has(dateKey);
    const isCustom = Object.prototype.hasOwnProperty.call(customSlotsByDate, dateKey);
    const slots = isCustom ? customSlotsByDate[dateKey] : defaultSlotsForDate();
    const isClosed = daysOff.has(dateKey);
    availabilityMode.textContent = isClosed
        ? 'The salon is closed on this date.'
        : isCustom
            ? 'Custom appointment times for this date.'
            : 'Using the default opening and closing hours.';
    availabilitySlotList.replaceChildren();
    availabilityEmpty.textContent = '';
    addAvailabilitySlotButton.disabled = isClosed;
    useDefaultSlotsButton.disabled = isClosed || !isCustom;

    if (!isClosed && slots.length === 0) {
        availabilityEmpty.textContent = 'No appointment times are set for this date.';
    }

    slots.forEach((slot, index) => {
        const row = el('div', 'availability-slot-row');
        const startLabel = el('label', '', 'Start');
        const startInput = el('input');
        startInput.type = 'time';
        startInput.step = '60';
        startInput.required = true;
        startInput.value = slot.startTime || '';
        startInput.setAttribute('aria-label', `Slot ${index + 1} start time`);
        startLabel.appendChild(startInput);

        const endLabel = el('label', '', 'End');
        const endInput = el('input');
        endInput.type = 'time';
        endInput.step = '60';
        endInput.required = true;
        endInput.value = slot.endTime || '';
        endInput.setAttribute('aria-label', `Slot ${index + 1} end time`);
        endLabel.appendChild(endInput);

        const removeButton = el('button', 'availability-remove-slot', 'Remove');
        removeButton.type = 'button';
        removeButton.disabled = isClosed;
        removeButton.addEventListener('click', () => {
            const editableSlots = ensureCustomSlots(dateKey);
            editableSlots.splice(index, 1);
            renderAvailabilitySlots();
        });

        [startInput, endInput].forEach((input) => {
            input.disabled = isClosed;
            input.addEventListener('change', () => {
                const editableSlots = ensureCustomSlots(dateKey);
                editableSlots[index][input === startInput ? 'startTime' : 'endTime'] = input.value;
                availabilityMode.textContent = 'Custom appointment times for this date.';
                useDefaultSlotsButton.disabled = false;
            });
        });

        row.append(startLabel, endLabel, removeButton);
        availabilitySlotList.appendChild(row);
    });
}

function renderDaysOffCalendar() {
    const year = calendarMonth.getUTCFullYear();
    const month = calendarMonth.getUTCMonth() + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    calendarMonthLabel.textContent = calendarMonth.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
    });
    daysOffCalendar.replaceChildren();

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((weekday) => {
        daysOffCalendar.appendChild(el('span', 'calendar-weekday', weekday));
    });
    for (let blank = 0; blank < firstWeekday; blank += 1) {
        daysOffCalendar.appendChild(el('span', 'calendar-empty', ''));
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = dayOffKey(year, month, day);
        const dayOff = daysOff.has(dateKey);
        const selected = dateKey === selectedAvailabilityDate;
        const button = el(
            'button',
            `calendar-day${dayOff ? ' is-day-off' : ''}${selected ? ' is-selected' : ''}`,
            String(day)
        );
        button.type = 'button';
        button.dataset.date = dateKey;
        button.disabled = !dateIsManageable(dateKey);
        button.setAttribute('aria-label', `${formattedDayOff(dateKey)}${dayOff ? ', salon closed' : ''}`);
        button.setAttribute('aria-pressed', String(selected));
        button.addEventListener('click', () => {
            selectedAvailabilityDate = dateKey;
            renderDaysOffCalendar();
            renderAvailabilitySlots();
        });
        daysOffCalendar.appendChild(button);
    }

    const firstMonth = new Date(Date.UTC(
        new Date(`${minimumAvailabilityDate}T00:00:00.000Z`).getUTCFullYear(),
        new Date(`${minimumAvailabilityDate}T00:00:00.000Z`).getUTCMonth(),
        1
    ));
    const lastDate = new Date(`${maximumAvailabilityDate}T00:00:00.000Z`);
    const lastMonth = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), 1));
    document.getElementById('calendar-previous').disabled = calendarMonth <= firstMonth;
    document.getElementById('calendar-next').disabled = calendarMonth >= lastMonth;

    const selectedDates = [...daysOff].sort();
    daysOffSummary.textContent = selectedDates.length
        ? `Closed dates: ${selectedDates.map(formattedDayOff).join(', ')}`
        : 'No days off selected.';
}

function fillHourOptions(select, firstHour, lastHour) {
    select.replaceChildren();
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
        const option = document.createElement('option');
        option.value = String(hour);
        if (hour === 24) {
            option.textContent = '12:00 AM (midnight)';
        } else {
            option.textContent = new Date(Date.UTC(2020, 0, 1, hour)).toLocaleTimeString('en-US', {
                timeZone: 'UTC',
                hour: 'numeric',
                minute: '2-digit',
            });
        }
        select.appendChild(option);
    }
}

async function loadSettings() {
    try {
        const data = await api('/api/admin/settings');
        fillHourOptions(openHourSelect, 0, 23);
        fillHourOptions(closeHourSelect, 1, 24);
        openHourSelect.value = String(data.settings.openHour);
        closeHourSelect.value = String(data.settings.closeHour);
        minimumAvailabilityDate = currentManilaDate();
        maximumAvailabilityDate = addDateDays(minimumAvailabilityDate, 60);
        daysOff = new Set((data.settings.daysOff || [])
            .filter((date) => date >= minimumAvailabilityDate && date <= maximumAvailabilityDate));
        customSlotsByDate = Object.fromEntries(
            Object.entries(data.settings.customSlotsByDate || {})
                .filter(([date, slots]) => date >= minimumAvailabilityDate
                    && date <= maximumAvailabilityDate
                    && Array.isArray(slots))
                .map(([date, slots]) => [date, slots.map((slot) => ({ ...slot }))])
        );
        selectedAvailabilityDate = minimumAvailabilityDate;
        calendarMonth = currentManilaMonth();
        renderDaysOffCalendar();
        renderAvailabilitySlots();
        showSettingsStatus('', '');
    } catch (error) {
        if (error.message !== 'Not logged in.') {
            showSettingsStatus(`Could not load settings. ${error.message}`, 'error');
        }
    }
}

async function saveSettings() {
    const saveButton = document.getElementById('settings-save');
    saveButton.disabled = true;
    showSettingsStatus('', '');
    try {
        const data = await api('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({
                openHour: Number(openHourSelect.value),
                closeHour: Number(closeHourSelect.value),
                daysOff: [...daysOff].sort(),
                customSlotsByDate,
            }),
        });
        daysOff = new Set(data.settings.daysOff);
        customSlotsByDate = data.settings.customSlotsByDate;
        renderDaysOffCalendar();
        renderAvailabilitySlots();
        showSettingsStatus('Settings saved.', 'success');
    } catch (error) {
        showSettingsStatus(error.message, 'error');
    } finally {
        saveButton.disabled = false;
    }
}

function selectAdminTab(name) {
    const showBookings = name === 'bookings';
    bookingsTab.setAttribute('aria-selected', String(showBookings));
    bookingsTab.tabIndex = showBookings ? 0 : -1;
    inquiriesTab.setAttribute('aria-selected', String(!showBookings));
    inquiriesTab.tabIndex = showBookings ? -1 : 0;
    bookingsPanel.hidden = !showBookings;
    inquiriesPanel.hidden = showBookings;
}

function selectBookingTab(name) {
    bookingTabs.forEach((tab) => {
        const selected = tab.name === name;
        tab.button.setAttribute('aria-selected', String(selected));
        tab.button.tabIndex = selected ? 0 : -1;
        tab.panel.hidden = !selected;
    });
}

bookingsTab.addEventListener('click', () => selectAdminTab('bookings'));
inquiriesTab.addEventListener('click', () => selectAdminTab('inquiries'));
document.querySelector('.admin-tabs').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextTab = event.target === bookingsTab ? inquiriesTab : bookingsTab;
        selectAdminTab(nextTab === bookingsTab ? 'bookings' : 'inquiries');
        nextTab.focus();
    }
});
bookingTabs.forEach((tab) => {
    tab.button.addEventListener('click', () => selectBookingTab(tab.name));
});
document.querySelector('.booking-view-switch').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const currentIndex = bookingTabs.findIndex((tab) => tab.button === event.target);
    if (currentIndex === -1) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = bookingTabs[(currentIndex + direction + bookingTabs.length) % bookingTabs.length];
    selectBookingTab(nextTab.name);
    nextTab.button.focus();
});
document.getElementById('bookings-refresh').addEventListener('click', () => loadBookings(true));
Object.entries(bookingSearch).forEach(([view, controls]) => {
    controls.type.addEventListener('change', () => updateBookingFilterInput(view));
    controls.value.addEventListener('input', () => renderBookingView(view));
    controls.service.addEventListener('change', () => renderBookingView(view));
});
document.getElementById('clear-pending-booking-filters')
    .addEventListener('click', () => clearBookingFilters('pending'));
document.getElementById('clear-decided-booking-filters')
    .addEventListener('click', () => clearBookingFilters('decided'));
document.getElementById('settings-save').addEventListener('click', saveSettings);
document.getElementById('calendar-previous').addEventListener('click', () => {
    calendarMonth = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() - 1, 1));
    renderDaysOffCalendar();
});
document.getElementById('calendar-next').addEventListener('click', () => {
    calendarMonth = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + 1, 1));
    renderDaysOffCalendar();
});
dayOffToggle.addEventListener('change', () => {
    if (dayOffToggle.checked) {
        daysOff.add(selectedAvailabilityDate);
    } else {
        daysOff.delete(selectedAvailabilityDate);
    }
    renderDaysOffCalendar();
    renderAvailabilitySlots();
});
addAvailabilitySlotButton.addEventListener('click', () => {
    ensureCustomSlots(selectedAvailabilityDate).push({ startTime: '', endTime: '' });
    renderAvailabilitySlots();
    availabilitySlotList.querySelector('.availability-slot-row:last-child input').focus();
});
useDefaultSlotsButton.addEventListener('click', () => {
    delete customSlotsByDate[selectedAvailabilityDate];
    renderAvailabilitySlots();
});
openHourSelect.addEventListener('change', renderAvailabilitySlots);
closeHourSelect.addEventListener('change', renderAvailabilitySlots);
selectBookingTab('availability');

async function changeStatus(inquiry, status, actions) {
    if (inquiry.status === status) return;
    actions.querySelectorAll('button').forEach((b) => (b.disabled = true));
    showStatus('', '');
    try {
        const result = await api('/api/admin/inquiries/' + inquiry.id, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        inquiry.status = result.inquiry.status;
        lastSnapshot = JSON.stringify(inquiries);
        render();
    } catch (error) {
        showStatus(error.message, 'error');
        actions.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
}

async function deleteInquiry(inquiry, actions) {
    if (!window.confirm(`Delete the inquiry from ${inquiry.name}? This cannot be undone.`)) return;
    actions.querySelectorAll('button').forEach((button) => (button.disabled = true));
    showStatus('', '');
    try {
        await api('/api/admin/inquiries/' + inquiry.id, { method: 'DELETE' });
        inquiries = inquiries.filter((item) => item.id !== inquiry.id);
        lastSnapshot = JSON.stringify(inquiries);
        renderServiceOptions();
        render();
        showStatus('Inquiry deleted.', 'success');
    } catch (error) {
        showStatus(error.message, 'error');
        actions.querySelectorAll('button').forEach((button) => (button.disabled = false));
    }
}

async function loadInquiries(showDone) {
    try {
        const data = await api('/api/admin/inquiries');
        const snapshot = JSON.stringify(data.inquiries);
        // Only redraw when something changed, so the page does not jump while she reads.
        if (snapshot !== lastSnapshot) {
            inquiries = data.inquiries;
            lastSnapshot = snapshot;
            renderServiceOptions();
            render();
        }
        showStatus(showDone ? 'Up to date.' : '', 'success');
    } catch (error) {
        if (error.message !== 'Not logged in.') {
            showStatus('Could not load inquiries. ' + error.message, 'error');
        }
    }
}

document.getElementById('refresh-button').addEventListener('click', () => loadInquiries(true));

function updateFilterInput() {
    const field = filterType.value;
    const isService = field === 'service';
    filterValue.hidden = isService;
    serviceValue.hidden = !isService;
    filterValue.value = '';
    serviceValue.value = '';

    if (field === 'date') {
        filterValue.type = 'date';
        filterValue.placeholder = '';
        filterValue.setAttribute('aria-label', 'Appointment date');
    } else {
        filterValue.type = 'search';
        filterValue.placeholder = field === 'email' ? 'Search by email' : 'Search by name';
        filterValue.setAttribute('aria-label', `Search by ${field}`);
    }
    render();
}

filterType.addEventListener('change', updateFilterInput);
filterValue.addEventListener('input', render);
serviceValue.addEventListener('change', render);
document.getElementById('clear-filters').addEventListener('click', () => {
    filterValue.value = '';
    serviceValue.value = '';
    currentFilter = 'all';
    render();
});

window.addEventListener('auth:logout', () => {
    window.location.href = 'admin-login.html';
});

(async function start() {
    try {
        const me = await api('/api/auth/me');
        if (me.user.role !== 'admin') {
            window.location.href = 'admin-login.html';
            return;
        }
    } catch (error) {
        return; // api() already sent the visitor to the owner login page
    }
    loading.hidden = true;
    dashboard.hidden = false;
    await Promise.all([loadBookings(false), loadSettings(), loadInquiries(false)]);
    setInterval(() => {
        loadBookings(false);
        loadInquiries(false);
    }, 60000);
})();