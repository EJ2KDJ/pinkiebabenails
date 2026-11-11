const form = document.getElementById('login-form');
const statusMessage = document.getElementById('login-status');
const submitButton = document.getElementById('auth-submit');
const modeButtons = [...document.querySelectorAll('[data-auth-mode]')];
const nameField = document.getElementById('name-field');
const phoneField = document.getElementById('phone-field');
const emailField = document.getElementById('email');
const emailFieldContainer = emailField.closest('.form-field');
const passwordField = document.getElementById('password-field');
const passwordInput = document.getElementById('password');
const passwordToggle = document.querySelector('.password-toggle');
const forgotLink = document.getElementById('forgot-password-link');
const authTitle = document.getElementById('auth-title');
const authDescription = document.getElementById('auth-description');
const authModes = document.getElementById('auth-modes');
const authNote = document.getElementById('auth-note');
const authBack = document.getElementById('auth-back');

const searchParams = new URLSearchParams(window.location.search);
const resetToken = searchParams.get('token');
let mode = resetToken ? 'reset' : searchParams.get('mode') === 'forgot' ? 'forgot' : 'login';

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'form-status' + (type ? ' form-status-' + type : '');
}

function setMode(nextMode) {
    mode = nextMode;
    const isSignup = mode === 'signup';
    const isForgot = mode === 'forgot';
    const isReset = mode === 'reset';
    const isRecovery = isForgot || isReset;

    nameField.hidden = !isSignup;
    nameField.querySelector('input').required = isSignup;
    phoneField.hidden = !isSignup;
    phoneField.querySelector('input').required = isSignup;
    emailFieldContainer.hidden = isReset;
    emailField.required = !isReset;
    passwordField.hidden = isForgot;
    passwordInput.required = !isForgot;
    passwordInput.minLength = isSignup || isReset ? 8 : 0;
    passwordInput.maxLength = 72;
    passwordInput.autocomplete = isSignup || isReset ? 'new-password' : 'current-password';
    passwordInput.setAttribute('aria-label', isReset ? 'New password' : 'Password');
    passwordField.querySelector('label').textContent = isReset ? 'New password' : 'Password';
    passwordInput.value = '';
    forgotLink.hidden = mode !== 'login';
    authModes.hidden = isRecovery;
    authBack.hidden = !isRecovery;
    authNote.hidden = !isSignup && !isForgot && !isReset;
    authNote.textContent = isSignup
        ? 'Create an account to make booking with PinkieBabe Nails easier.'
        : isForgot
            ? 'Enter the email address linked to your account. We will email you a reset link if it exists.'
            : isReset
                ? 'Choose a new password with at least 8 characters.'
                : '';

    authTitle.textContent = isSignup ? 'Create your account'
        : isForgot ? 'Forgot your password?'
            : isReset ? 'Reset your password'
                : 'Welcome back';
    authDescription.textContent = isSignup ? 'Sign up to get started.'
        : isForgot ? 'We will help you get back into your account.'
            : isReset ? 'Set a new password for your account.'
                : 'Log in or create an account to get started.';
    submitButton.textContent = isSignup ? 'Create account'
        : isForgot ? 'Send reset link'
            : isReset ? 'Reset password'
                : 'Log in';

    modeButtons.forEach((button) => {
        const active = button.dataset.authMode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    passwordInput.type = 'password';
    passwordToggle.setAttribute('aria-label', 'Show password');
    passwordToggle.setAttribute('aria-pressed', 'false');
    showStatus('', '');
}

function goToHome(user) {
    window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
}

async function skipIfLoggedIn() {
    if (mode === 'reset') return;
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            goToHome(result.user);
        }
    } catch (error) {
        // A server connection failure should not prevent the visitor from using the form.
    }
}

modeButtons.forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.authMode));
});

forgotLink.addEventListener('click', () => setMode('forgot'));

authBack.addEventListener('click', () => setMode('login'));

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

    const endpoint = mode === 'signup' ? '/api/auth/register'
        : mode === 'forgot' ? '/api/auth/forgot-password'
            : mode === 'reset' ? '/api/auth/reset-password'
                : '/api/auth/login';
    const payload = mode === 'signup'
        ? {
            name: form.elements.name.value,
            email: form.elements.email.value,
            phoneNumber: form.elements.phoneNumber.value,
            password: form.elements.password.value,
        }
        : mode === 'forgot'
            ? { email: form.elements.email.value }
            : mode === 'reset'
                ? { token: resetToken, password: form.elements.password.value }
                : {
                    email: form.elements.email.value,
                    password: form.elements.password.value,
                };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus((result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
        } else if (mode === 'signup' || mode === 'login') {
            goToHome(result.user);
            return;
        } else if (mode === 'forgot') {
            showStatus(result.message, 'success');
        } else {
            window.history.replaceState(null, '', window.location.pathname);
            setMode('login');
            showStatus(result.message, 'success');
        }
    } catch (error) {
        showStatus('Could not reach the server. Please check your connection and try again.', 'error');
    }

    submitButton.disabled = false;
});

setMode(mode);
skipIfLoggedIn();
