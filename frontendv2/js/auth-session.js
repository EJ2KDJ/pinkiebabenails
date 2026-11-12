const AUTH_TAB_STORAGE_KEY = 'pinkiebabe-auth-tab';
let authTabId = sessionStorage.getItem(AUTH_TAB_STORAGE_KEY);

if (!authTabId || !/^[a-f0-9]{64}$/i.test(authTabId)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    authTabId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(AUTH_TAB_STORAGE_KEY, authTabId);
}

window.authSessionHeaders = () => ({ 'X-Auth-Tab': authTabId });
