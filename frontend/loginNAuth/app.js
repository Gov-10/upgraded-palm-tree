const registrationForm = document.getElementById('registrationForm');

if (registrationForm){
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await register();
    });
}
async function register() {
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const registrationData = {
        email: email,
        username: username,
        password: password
    };

    try {
        const response = await fetch('http://localhost:8000/create', { //use actual API endpoint during production, I have used localhost here because currently I am testing the backend on localhost
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Registration successful:', data);
            alert('Registration successful! Please login.');
            localStorage.setItem('email', email);
            registrationForm.reset();
            window.location.href = 'auth.html';
        } else {
            console.error('Registration failed:', data);
            alert('Registration failed: ' + (data.message || 'Please try again.'));
        }
    } catch (error) {
        console.error('Error during registration:', error);
        alert('An error occurred. Please try again.');
    }
}

const authForm = document.getElementById('authForm');

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await verify();
    });
}

async function verify() {
    const otp = document.getElementById('otp').value;
    const email = localStorage.getItem('email');

    const verificationData = {
        otp: otp,
        email: email
    };

    try {
        const response = await fetch('http://localhost:8000/verify', { //use actual API endpoint during production, I have used localhost here because currently I am testing the backend on localhost
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(verificationData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('OTP verification successful:', data);
            alert('OTP verified! Redirecting to login page.');
            window.location.href = 'login.html';
        } else {
            console.error('OTP verification failed:', data);
            alert('OTP verification failed: ' + (data.message || 'Please try again.'));
        }
    } catch (error) {
        console.error('Error during OTP verification:', error);
        alert('An error occurred. Please try again.');
    }
}

const loginForm = document.getElementById('loginForm')

if (loginForm)
{
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        await login()
    });
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const loginData = {
        username: username,
        password: password
    };

    try {
        const response = await fetch('http://localhost:8000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Login successful:', data);
            alert('Login successful!');
            loginForm.reset();
            window.location.href = "../console/overview/overview.html"
        } else {
            console.error('Login failed:', data);
            alert('Login failed: ' + (data.message || 'Please try again.'));
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please try again.');
    }
}

// Dynamic Background Canvas Animation
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    });

    let mouseX = w / 2;
    let mouseY = h / 2;

    window.addEventListener("mousemove", (e) => {
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
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
    }

    function animate() {
        ctx.clearRect(0, 0, w, h);
        
        let gradient = ctx.createRadialGradient(mouseX, mouseY, 50, w/2, h/2, Math.max(w, h));
        gradient.addColorStop(0, "#0c152b");
        gradient.addColorStop(1, "#060913");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        angle += 0.001;

        let cx = w / 2;
        let cy = h / 2;

        ctx.strokeStyle = "rgba(37, 99, 235, 0.08)";
        ctx.lineWidth = 1.5;
        drawMandala(cx, cy, 250, 45, 12, 4);

        ctx.strokeStyle = "rgba(16, 185, 129, 0.06)";
        ctx.lineWidth = 1.0;
        drawMandala(cx, cy, 180, 30, 8, 3);

        ctx.strokeStyle = "rgba(245, 158, 11, 0.04)";
        ctx.lineWidth = 1.0;
        drawMandala(cx, cy, 100, 15, 6, 2);

        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        for (let i = 0; i < 40; i++) {
            let pX = (Math.sin(angle * (i + 1) * 0.1) * w/3) + cx;
            let pY = (Math.cos(angle * (i + 1) * 0.1) * h/3) + cy;
            ctx.beginPath();
            ctx.arc(pX, pY, 2 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    animate();
});

