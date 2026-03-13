export const API_URL = 'http://localhost:8080/api/auth';
export const BOOKS_API = 'http://localhost:8080/api/books';
export const READING_API = 'http://localhost:8080/api/reading';

export async function handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(data?.message || `Ошибка: ${response.status}`);
    return data;
}

export async function authorizedFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = {'Content-Type': 'application/json', ...options.headers};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {...options, headers});

    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    return response;
}
