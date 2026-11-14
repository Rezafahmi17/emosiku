// =========================================================================
// API HELPER & OFFLINE-SAFE FALLBACK CLIENT UNTUK EMOSIKU
// =========================================================================

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api';

const STORAGE_KEYS = {
    TOKEN: 'emosiku_token',
    USER: 'emosiku_user',
    FONT_SCALE: 'emosiku_font_scale',
    HIGH_CONTRAST: 'emosiku_high_contrast',
    CONSENT_ACCEPTED: 'emosiku_consent_accepted',
    LOCAL_EMOTIONS: 'emosiku_local_emotions',
    LOCAL_JOURNALS: 'emosiku_local_journals',
    LOCAL_COUNSELING: 'emosiku_local_counseling',
    LOCAL_CHATS: 'emosiku_local_chats'
};

window.EmosikuAPI = {
    getToken() {
        return localStorage.getItem(STORAGE_KEYS.TOKEN);
    },

    getUser() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.USER);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    setSession(token, user) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    },

    clearSession() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Permintaan ke server gagal.');
            }
            return data;
        } catch (err) {
            throw err;
        }
    }
};

