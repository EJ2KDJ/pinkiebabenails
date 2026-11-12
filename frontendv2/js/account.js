const accountStatus = document.getElementById('account-status');
const accountForm = document.getElementById('account-form');
const passwordForm = document.getElementById('password-form');
const profileStatus = document.getElementById('profile-status');
const passwordStatus = document.getElementById('password-status');

window.addEventListener('auth:logout', () => {
    window.location.href = 'login.html';
});

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'form-status' + (type ? ' form-status-' + type : '');
}

async function submitForm(form, endpoint, payload, statusElement, button, successMessage) {
    button.disabled = true;
    showStatus(statusElement, '', '');
    try {
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: { ...window.authSessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(statusElement, (result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
            return null;
        }
        showStatus(statusElement, successMessage, 'success');
        return result;
    } catch (error) {
        showStatus(statusElement, 'Could not reach the server. Please check your connection and try again.', 'error');
        console.error('Updating account failed:', error);
        return null;
    } finally {
        button.disabled = false;
    }
}

accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await submitForm(
        accountForm,
        '/api/auth/me',
        { name: accountForm.elements.name.value, email: accountForm.elements.email.value },
        profileStatus,
        document.getElementById('profile-submit'),
        'Account details saved.'
    );
    if (result) {
        accountForm.elements.name.value = result.user.name;
        accountForm.elements.email.value = result.user.email;
    }
});

passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('password-submit');
    button.disabled = true;
    showStatus(passwordStatus, '', '');
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { ...window.authSessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: passwordForm.elements.currentPassword.value,
                newPassword: passwordForm.elements.newPassword.value,
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(passwordStatus, (result.errors || ['Something went wrong. Please try again.']).join(' '), 'error');
            return;
        }
        passwordForm.reset();
        showStatus(passwordStatus, result.message, 'success');
    } catch (error) {
        showStatus(passwordStatus, 'Could not reach the server. Please check your connection and try again.', 'error');
        console.error('Changing account password failed:', error);
    } finally {
        button.disabled = false;
    }
});

fetch('/api/auth/me', { headers: window.authSessionHeaders() })
    .then(async (response) => {
        if (response.status === 401) {
            window.location.href = 'login.html';
            return null;
        }
        if (!response.ok) {
            throw new Error(`Account request failed (${response.status}).`);
        }
        return response.json();
    })
    .then((result) => {
        if (!result) return;
        document.getElementById('account-name').textContent = result.user.name;
        document.getElementById('account-email').textContent = result.user.email;
        accountForm.hidden = false;
        passwordForm.hidden = false;
        accountStatus.hidden = true;
    })
    .catch((error) => {
        accountStatus.textContent = 'Unable to load your account. Please try again later.';
        console.error('Loading account details failed:', error);
    });
