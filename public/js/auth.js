// public/js/auth.js
// Shared utility functions used by ALL pages (signup, login, forgot-pw, verify-otp)

// ── API helper — sends POST request to server ────────────────────────────────
async function apiCall(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (err) {
        console.error('API Error:', err);
        return { success: false, message: 'Could not connect to server. Is it running?' };
    }
}

// ── Show / hide main alert box ────────────────────────────────────────────────
function showAlert(type, message) {
    const box = document.getElementById('alertBox');
    const msg = document.getElementById('alertMsg');
    const icon = document.getElementById('alertIcon');

    box.className = 'alert show alert-' + type;
    msg.innerHTML = message;

    const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
    if (icon) icon.textContent = icons[type] || '⚠️';

    // Auto-hide error alerts after 8 seconds
    if (type === 'error') {
        clearTimeout(box._timer);
        box._timer = setTimeout(() => box.classList.remove('show'), 8000);
    }
}

// ── Show error text below a field ──────────────────────────────────────────────
function showFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) { el.textContent = message; el.classList.add('show'); }

    // Also highlight the input above it
    const input = el && el.previousElementSibling;
    if (input && (input.tagName === 'INPUT' || input.classList.contains('password-wrapper'))) {
        const inp = input.tagName === 'INPUT' ? input : input.querySelector('input');
        if (inp) inp.classList.add('error-input');
    }
}

// ── Clear all error states ────────────────────────────────────────────────────
function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    document.querySelectorAll('input.error-input').forEach(el => {
        el.classList.remove('error-input');
    });
    const box = document.getElementById('alertBox');
    if (box) box.classList.remove('show');
}

// ── Button loading state ───────────────────────────────────────────────────────
function setLoading(btn, isLoading, text) {
    btn.disabled = isLoading;
    btn.textContent = text;
    if (isLoading) btn.classList.add('loading');
    else btn.classList.remove('loading');
}

// ── Password visibility toggle ─────────────────────────────────────────────────
function togglePw(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
        inp.type = 'text';
        btn.textContent = '🙈';
    } else {
        inp.type = 'password';
        btn.textContent = '👁️';
    }
}

// ── Only allow digits in phone number field ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }
});
