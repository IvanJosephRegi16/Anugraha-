// public/js/app.js — Logic for logged-in CRM users
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Authentication
    const authRes = await fetch('/api/me');
    const authData = await authRes.json();

    if (!authData.loggedIn) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    // Restore sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }

    // 3. User Info in Top Nav
    const nameEl = document.getElementById('userDisplayName');
    const initialEl = document.getElementById('userInitial');
    if (nameEl) nameEl.innerText = authData.name;
    if (initialEl) initialEl.innerText = authData.name.charAt(0).toUpperCase();

    // 4. Highlight current nav item
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 5. Update Notifications
    updateNotifications();
});

async function updateNotifications() {
    try {
        const res = await fetch('/api/crm/stats');
        const data = await res.json();
        if (data.success) {
            const badge = document.getElementById('notifBadge');
            if (badge) {
                if (data.overdueCount > 0) {
                    badge.innerText = data.overdueCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (err) {
        console.error('Failed to update notifications:', err);
    }
}

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await fetch('/api/logout');
        window.location.href = 'login.html';
    }
}
