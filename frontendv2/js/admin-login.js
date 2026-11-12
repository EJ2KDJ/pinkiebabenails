const form = document.getElementById('admin-login-form');
const statusMessage = document.getElementById('admin-login-status');
const submitButton = document.getElementById('admin-login-submit');
const passwordInput = document.getElementById('password');
const passwordToggle = document.querySelector('.password-toggle');

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status' + (type ? ' form-status-' + type : '');
}

async function redirectIfAdminIsLoggedIn() {
    try {
        const response = await fetch('/api/auth/me', { headers: window.authSessionHeaders() });
        if (!response.ok) return;
        const result = await response.json();
        if (result.user.role === 'admin') {
            window.location.href = 'admin.html';
        }
    } catch (error) {
        // Keep the sign-in form available if the session check cannot reach the server.
    }
}

passwordToggle.addEventListener('click', () => {
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    passwordToggle.setAttribute('aria-pressed', String(!isVisible));
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus('', '');
    submitButton.disabled = true;

    try {
        const response = await fetch('/api/auth/admin-login', {
            method: 'POST',
            headers: { ...window.authSessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: form.elements.email.value,
                password: form.elements.password.value,
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus((result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
        } else if (result.user.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        } else {
            showStatus('This account does not have owner access.', 'error');
        }
    } catch (error) {
        showStatus('Could not reach the server. Please check your connection and try again.', 'error');
    }

    submitButton.disabled = false;
});

redirectIfAdminIsLoggedIn();
