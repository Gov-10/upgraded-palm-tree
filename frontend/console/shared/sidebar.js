/* ==============================================
   GST Ledger Hub - Shared Sidebar JS
   Handles: toggle, active state, background anim,
            theme toggle injection
   ============================================== */

(function () {
    // Sidebar toggle logic
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const COLLAPSED_KEY = 'sidebar_collapsed';

    function applyCollapsedState(collapsed) {
        if (collapsed) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            document.body.classList.remove('sidebar-collapsed');
        }
        const icon = toggleBtn ? toggleBtn.querySelector('i') : null;
        if (icon) {
            icon.className = collapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
        }
    }

    // Restore from localStorage
    const savedState = localStorage.getItem(COLLAPSED_KEY) === 'true';
    applyCollapsedState(savedState);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.contains('collapsed');
            const newState = !isCollapsed;
            applyCollapsedState(newState);
            localStorage.setItem(COLLAPSED_KEY, String(newState));
        });
    }

    // Inject theme toggle button into topbar-right or top-right corner
    const topbarRight = document.querySelector('.console-topbar .topbar-right');
    const currentTheme = localStorage.getItem('gst_theme') || 'dark';
    
    const themeBtn = document.createElement('button');
    themeBtn.className = 'topbar-theme-toggle-btn theme-toggle-btn';
    themeBtn.id = 'topbar-theme-toggle';
    themeBtn.innerHTML = `<i class="${currentTheme === 'light' ? 'ti ti-moon' : 'ti ti-sun'}"></i>`;
    themeBtn.title = currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    // Click event is handled globally via delegation in theme.js

    if (topbarRight) {
        // Insert as first item in topbar actions
        topbarRight.insertBefore(themeBtn, topbarRight.firstChild);
    } else {
        // Fallback to top-right floating corner if topbar doesn't exist
        themeBtn.classList.add('floating-theme-toggle');
        document.body.appendChild(themeBtn);
    }

    // Mobile overlay toggle
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-open') &&
                !sidebar.contains(e.target) &&
                e.target !== mobileToggle) {
                sidebar.classList.remove('mobile-open');
            }
        });
    }

    // Mark active nav item based on current page
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item[href], .nav-sub-item[href]');
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && currentPath.endsWith(href.split('/').pop())) {
            item.classList.add('active');
        }
    });

    // Background Canvas Animation (identical to dashboard)
    function initDynamicBackground() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        });

        let mouseX = w / 2;
        let mouseY = h / 2;

        window.addEventListener('mousemove', (e) => {
            mouseX += (e.clientX - mouseX) * 0.05;
            mouseY += (e.clientY - mouseY) * 0.05;
        });

        let angle = 0;

        function drawMandala(cx, cy, radius, petLength, petals, complexity) {
            ctx.beginPath();
            for (let i = 0; i < petals * complexity; i++) {
                let theta = (i * Math.PI * 2) / (petals * complexity) + angle;
                let r = radius + Math.sin(theta * petals) * petLength;
                r += Math.cos(theta * 3 + (mouseX / w) * 10) * 15;
                let x = cx + Math.cos(theta) * r;
                let y = cy + Math.sin(theta) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        function animate() {
            ctx.clearRect(0, 0, w, h);

            // Get computed theme colors from CSS variables
            const style = getComputedStyle(document.documentElement);
            const bg1 = style.getPropertyValue('--color-canvas-bg-1').trim() || '#0c152b';
            const bg2 = style.getPropertyValue('--color-canvas-bg-2').trim() || '#060913';

            let gradient = ctx.createRadialGradient(mouseX, mouseY, 50, w / 2, h / 2, Math.max(w, h));
            gradient.addColorStop(0, bg1);
            gradient.addColorStop(1, bg2);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            angle += 0.001;
            const cx = w / 2, cy = h / 2;

            ctx.strokeStyle = 'rgba(37, 99, 235, 0.08)';
            ctx.lineWidth = 1.5;
            drawMandala(cx, cy, 250, 45, 12, 4);

            ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)';
            ctx.lineWidth = 1.0;
            drawMandala(cx, cy, 180, 30, 8, 3);

            ctx.strokeStyle = 'rgba(245, 158, 11, 0.04)';
            ctx.lineWidth = 1.0;
            drawMandala(cx, cy, 100, 15, 6, 2);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            for (let i = 0; i < 40; i++) {
                let pX = (Math.sin(angle * (i + 1) * 0.1) * w / 3) + cx;
                let pY = (Math.cos(angle * (i + 1) * 0.1) * h / 3) + cy;
                ctx.beginPath();
                ctx.arc(pX, pY, 2 + (i % 3), 0, Math.PI * 2);
                ctx.fill();
            }

            requestAnimationFrame(animate);
        }
        animate();
    }

    document.addEventListener('DOMContentLoaded', initDynamicBackground);
})();
