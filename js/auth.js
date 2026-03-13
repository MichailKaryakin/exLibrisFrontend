import {API_URL, handleResponse} from './api.js';
import {showMessage} from './ui.js';

// ─── TOGGLE ФОРМ ──────────────────────────────────────────────────────────────

export function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const title = document.getElementById('auth-title');

    const showLogin = loginForm.style.display === 'none';
    loginForm.style.display = showLogin ? 'block' : 'none';
    regForm.style.display = showLogin ? 'none' : 'block';
    title.innerText = showLogin ? 'Вход в ExLibris' : 'Регистрация';
}

export function initAuth(onLoginSuccess) {

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password})
            });

            const data = await handleResponse(response);
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);

            showMessage('Вход выполнен!', 'success');
            onLoginSuccess?.();

        } catch (err) {
            showMessage(err.message, 'error');
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password})
            });

            await handleResponse(response);
            showMessage('Аккаунт создан! Войдите.', 'success');
            toggleAuth();

        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}
