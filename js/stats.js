import {READING_API, authorizedFetch, handleResponse} from './api.js';

export async function loadStats() {
    const section = document.getElementById('stats-section');
    section.innerHTML = '<div class="section-header"><h2>Статистика</h2></div><p class="loading-msg">Загрузка...</p>';

    try {
        const response = await authorizedFetch(`${READING_API}/stats`);
        const stats = await handleResponse(response);
        renderStats(stats);
    } catch (err) {
        section.innerHTML += `<p class="error">${err.message}</p>`;
    }
}

function renderStats(s) {
    const section = document.getElementById('stats-section');

    const avgScore = s.averageScore > 0
        ? s.averageScore.toFixed(1)
        : '—';

    const totalBooks = s.totalBooksFinished + s.totalBooksAbandoned + s.totalBooksInProgress;

    section.innerHTML = `
        <div class="section-header"><h2>Статистика</h2></div>

        <div class="stats-grid">

            <div class="stat-card stat-card--reading">
                <div class="stat-icon">📖</div>
                <div class="stat-value">${s.totalBooksInProgress}</div>
                <div class="stat-label">Читаю сейчас</div>
            </div>

            <div class="stat-card stat-card--finished">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${s.totalBooksFinished}</div>
                <div class="stat-label">Прочитано</div>
            </div>

            <div class="stat-card stat-card--abandoned">
                <div class="stat-icon">🚫</div>
                <div class="stat-value">${s.totalBooksAbandoned}</div>
                <div class="stat-label">Брошено</div>
            </div>

            <div class="stat-card stat-card--pages">
                <div class="stat-icon">📄</div>
                <div class="stat-value">${s.totalPagesRead.toLocaleString('ru')}</div>
                <div class="stat-label">Страниц прочитано</div>
            </div>

            <div class="stat-card stat-card--score">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">${avgScore}</div>
                <div class="stat-label">Средняя оценка</div>
            </div>

            <div class="stat-card stat-card--total">
                <div class="stat-icon">📚</div>
                <div class="stat-value">${totalBooks}</div>
                <div class="stat-label">Всего отслеживается</div>
            </div>

        </div>
    `;
}
