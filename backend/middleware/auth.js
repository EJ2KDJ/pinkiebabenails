const jwt = require('jsonwebtoken');

const db = require('../src/models');

const COOKIE_NAME = 'token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not set');
    }
    return process.env.JWT_SECRET;
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
    };
}

function setAuthCookie(res, user, tabId) {
    const token = jwt.sign({ id: user.id, role: user.role, tabId }, getSecret(), {
        algorithm: 'HS256',
        expiresIn: '7d',
    });
    const options = cookieOptions();
    const attributes = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'Max-Age=604800',
        'HttpOnly',
        `SameSite=${options.sameSite}`,
    ];
    if (options.secure) attributes.push('Secure');
    res.append('Set-Cookie', attributes.join('; '));
}

function clearAuthCookie(res) {
    const options = cookieOptions();
    const attributes = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'HttpOnly',
        `SameSite=${options.sameSite}`,
    ];
    if (options.secure) attributes.push('Secure');
    res.append('Set-Cookie', attributes.join('; '));
}

function getAuthToken(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookie = cookieHeader.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return null;
    try {
        return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
    } catch (error) {
        return null;
    }
}

// Reads the cookie and puts { id, role } on req.user, or answers 401.
function requireAuth(req, res, next) {
    const token = getAuthToken(req);
    if (!token) {
        return res.status(401).json({ errors: ['Please log in.'] });
    }

    try {
        req.user = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
        if (!req.user.tabId || req.get('X-Auth-Tab') !== req.user.tabId) {
            return res.status(401).json({ errors: ['Please log in in this tab.'] });
        }
        return next();
    } catch (error) {
        const badToken = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name);
        if (badToken) {
            clearAuthCookie(res);
            return res.status(401).json({ errors: ['Your session has expired. Please log in again.'] });
        }
        console.error('Auth check failed:', error.message);
        return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
    }
}

// Same as requireAuth, and also checks the database that this user still exists
// and is an admin, so a deleted or changed account stops working right away.
async function requireAdmin(req, res, next) {
    requireAuth(req, res, async () => {
        try {
            const user = await db.User.findByPk(req.user.id);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ errors: ['You do not have access to this page.'] });
            }
            req.currentUser = user;
            return next();
        } catch (error) {
            console.error('Admin check failed:', error.message);
            return res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
        }
    });
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireAdmin };