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
            window.location.href = "http://localhost:3000/" //use the upload page path here to redirect to the upload page after login
        } else {
            console.error('Login failed:', data);
            alert('Login failed: ' + (data.message || 'Please try again.'));
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please try again.');
    }
}
