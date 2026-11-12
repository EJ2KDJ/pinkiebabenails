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

let inquiries = [];
let currentFilter = 'all';
let lastSnapshot = '';

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
        throw new Error((data.errors || ['Something went wrong. Please try again.']).join(' '));
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
    [...new Set(inquiries.map((inquiry) => inquiry.service))]
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

    const phone = el('a', 'text-link', inquiry.phoneNumber);
    phone.href = 'tel:' + inquiry.phoneNumber.replace(/[^0-9+]/g, '');
    detailRow(dl, 'Phone', phone);

    const email = el('a', 'text-link', inquiry.email);
    email.href = 'mailto:' + inquiry.email;
    detailRow(dl, 'Email', email);

    detailRow(dl, 'Service', inquiry.service);
    detailRow(dl, 'Preferred date & time', formatDateTime(inquiry.preferredDateTime));

    if (inquiry.nailDesignReference) {
        const note = el('span', 'inquiry-note');
        appendWithLinks(note, inquiry.nailDesignReference);
        detailRow(dl, 'Nail design / reference', note);
    } else {
        detailRow(dl, 'Nail design / reference', 'None provided');
    }
    detailRow(dl, 'Gel/product removal', inquiry.gelProductRemovalNeeded ? 'Yes' : 'No');
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
    await loadInquiries(false);
    setInterval(() => loadInquiries(false), 60000); // new inquiries show up by themselves
})();