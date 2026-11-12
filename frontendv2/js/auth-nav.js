const siteNav = document.querySelector('.site-nav');

if (siteNav) {
    const authActions = document.createElement('div');
    authActions.className = 'auth-nav-actions';
    authActions.setAttribute('aria-label', 'Account actions');
    siteNav.parentElement.appendChild(authActions);

    const authStatus = document.createElement('span');
    authStatus.className = 'auth-nav-status';
    authStatus.setAttribute('role', 'status');
    authStatus.setAttribute('aria-live', 'polite');
    authStatus.hidden = true;
    authActions.appendChild(authStatus);

    function setAuthStatus(message) {
        authStatus.textContent = message;
        authStatus.hidden = !message;
    }

    function renderAuthLinks(user) {
        siteNav.querySelectorAll('[data-auth-generated]').forEach((item) => item.remove());
        authActions.querySelectorAll('[data-auth-generated]').forEach((item) => item.remove());

        if (!user) {
            const loginLink = document.createElement('a');
            loginLink.href = 'login.html';
            loginLink.className = 'auth-nav-login';
            loginLink.textContent = 'Login / Sign Up';
            loginLink.dataset.authGenerated = '';
            authActions.insertBefore(loginLink, authStatus);
            return;
        }

        if (user.role === 'admin') {
            const dashboardLink = document.createElement('a');
            dashboardLink.href = 'admin.html';
            dashboardLink.textContent = 'Dashboard';
            dashboardLink.dataset.authGenerated = '';
            if (window.location.pathname.endsWith('/admin.html')) {
                dashboardLink.setAttribute('aria-current', 'page');
            }
            authActions.insertBefore(dashboardLink, authStatus);
        }
        const accountLink = document.createElement('a');
        accountLink.href = 'account.html';
        accountLink.textContent = 'My Account';
        accountLink.dataset.authGenerated = '';
        if (window.location.pathname.endsWith('/account.html')) {
            accountLink.setAttribute('aria-current', 'page');
        }
        authActions.insertBefore(accountLink, authStatus);

        const logoutButton = document.createElement('button');
        logoutButton.type = 'button';
        logoutButton.className = 'auth-nav-logout';
        logoutButton.textContent = 'Logout';
        logoutButton.dataset.authGenerated = '';
        logoutButton.addEventListener('click', async () => {
            logoutButton.disabled = true;
            setAuthStatus('');
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: window.authSessionHeaders(),
                });
                if (!response.ok) {
                    throw new Error('The server could not end this session.');
                }
                renderAuthLinks(null);
                if (window.location.pathname.endsWith('/admin.html') || window.location.pathname.endsWith('/account.html')) {
                    window.dispatchEvent(new Event('auth:logout'));
                }
            } catch (error) {
                logoutButton.disabled = false;
                setAuthStatus('Unable to log out. Please try again.');
                console.error('Logout failed:', error);
            }
        });
        authActions.insertBefore(logoutButton, authStatus);
    }

    renderAuthLinks(null);

    fetch('/api/auth/me', { headers: window.authSessionHeaders() })
        .then(async (response) => {
            if (response.status === 401) return null;
            if (!response.ok) throw new Error(`Authentication check failed (${response.status}).`);

            const result = await response.json();
            if (!result.user || !['admin', 'customer'].includes(result.user.role)) {
                throw new Error('The authentication response did not contain a valid user.');
            }
            return result.user;
        })
        .then((user) => {
            renderAuthLinks(user);
            setAuthStatus('');
        })
        .catch((error) => {
            setAuthStatus('Unable to check your sign-in status.');
            console.error('Authentication check failed:', error);
        });
}
