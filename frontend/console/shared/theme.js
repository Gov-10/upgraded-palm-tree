/* ==============================================
   GST Ledger Hub - Global Theme Toggle
   Persists preference in localStorage as 'theme'
   Applies 'light-mode' class to <html>
   ============================================== */

(function () {
    const THEME_KEY = 'gst_theme';
    const root = document.documentElement;

    function applyTheme(theme) {
        if (theme === 'light') {
            root.classList.add('light-mode');
        } else {
            root.classList.remove('light-mode');
        }
    }

    // Apply saved theme immediately (before paint) to avoid flash
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    // Expose global toggle function
    window.toggleTheme = function () {
        const current = localStorage.getItem(THEME_KEY) || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
        updateThemeToggleIcons(next);
    };

    window.getCurrentTheme = function () {
        return localStorage.getItem(THEME_KEY) || 'dark';
    };

    // Update all theme toggle buttons on the page
    window.updateThemeToggleIcons = function (theme) {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            const label = btn.querySelector('.theme-toggle-label');
            if (icon) {
                icon.className = theme === 'light' ? 'ti ti-moon' : 'ti ti-sun';
            }
            if (label) {
                label.textContent = theme === 'light' ? 'Dark' : 'Light';
            }
            btn.setAttribute('title', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
        });
    };

    // Init icons on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        const theme = localStorage.getItem(THEME_KEY) || 'dark';
        updateThemeToggleIcons(theme);
    });

    // Use event delegation on document so dynamically injected buttons work
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-toggle-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            window.toggleTheme();
        }
    });
})();
