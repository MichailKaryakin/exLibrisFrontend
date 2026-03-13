import {READING_API, BOOKS_API, authorizedFetch, handleResponse} from './api.js';
import {showMessage} from './ui.js';
import {sectionShownAt} from './app.js';

const PAGE_SIZE = 12;
const FETCH_ALL_SIZE = 2000;
const COVER_BASE = 'http://localhost:8080/api/books/isbn';

const STATUS_LABELS = {
    READING: 'Читаю',
    FINISHED: 'Прочитано',
    ABANDONED: 'Брошено'
};

let currentStatus = 'READING';
let allReadings = [];
let filteredReadings = [];
let currentPage = 0;
let currentSearch = '';
let searchTimeout = null;
const cardCache = new Map();

export async function loadAllReadings() {
    const list = document.getElementById('reading-list');
    list.innerHTML = '<p class="loading-msg">Загрузка...</p>';

    try {
        const response = await authorizedFetch(`${READING_API}?size=${FETCH_ALL_SIZE}`);
        const data = await handleResponse(response);
        allReadings = data.content || data;
        applyFilters();
    } catch (err) {
        list.innerHTML = `<p class="error">${err.message}</p>`;
    }
}

async function reloadReadings(preservePage = false) {
    try {
        const response = await authorizedFetch(`${READING_API}?size=${FETCH_ALL_SIZE}`);
        const data = await handleResponse(response);
        allReadings = data.content || data;
        cardCache.clear();
        applyFilters(preservePage);
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

export function switchStatus(status) {
    currentStatus = status;
    currentSearch = '';

    const searchInput = document.getElementById('reading-search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.reading-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    applyFilters();
}

export function loadReadings(status = currentStatus) {
    if (allReadings.length === 0) {
        currentStatus = status;
        return loadAllReadings();
    }
    switchStatus(status);
    return Promise.resolve();
}

function applyFilters(preservePage = false) {
    const q = currentSearch.toLowerCase();

    filteredReadings = allReadings.filter(r => {
        const matchStatus = r.status === currentStatus;
        const matchSearch = !q ||
            (r.book.title && r.book.title.toLowerCase().includes(q)) ||
            (r.book.author && r.book.author.toLowerCase().includes(q));
        return matchStatus && matchSearch;
    });

    if (!preservePage) {
        currentPage = 0;
    } else {
        const totalPages = Math.ceil(filteredReadings.length / PAGE_SIZE);
        if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
    }

    renderPage();
}

export function initReadingSearch() {
    const input = document.getElementById('reading-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = input.value.trim();
            applyFilters();
        }, 200);
    });
}

function renderPage() {
    const start = currentPage * PAGE_SIZE;
    renderReadingCards(filteredReadings.slice(start, start + PAGE_SIZE));
    updatePaginationUI();
}

function updatePaginationUI() {
    const totalPages = Math.ceil(filteredReadings.length / PAGE_SIZE);
    const prevBtn = document.getElementById('reading-prev-page');
    const nextBtn = document.getElementById('reading-next-page');
    const pageInfo = document.getElementById('reading-page-info');

    if (!prevBtn || !nextBtn || !pageInfo) return;

    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    pageInfo.innerText = totalPages === 0
        ? 'Страница 0 из 0'
        : `Страница ${currentPage + 1} из ${totalPages}`;

    newPrev.disabled = currentPage === 0;
    newNext.disabled = currentPage >= totalPages - 1;

    const CLICK_GUARD_MS = 300;

    newPrev.addEventListener('click', () => {
        if (Date.now() - sectionShownAt < CLICK_GUARD_MS) return;
        currentPage--;
        renderPage();
    });
    newNext.addEventListener('click', () => {
        if (Date.now() - sectionShownAt < CLICK_GUARD_MS) return;
        currentPage++;
        renderPage();
    });
}

function createReadingCard(reading) {
    const percent = Math.round(reading.progressPercentage || 0);
    const showProgress = reading.status === 'READING';
    const showScore = reading.status === 'FINISHED' || reading.status === 'ABANDONED';
    const isbn = reading.book.isbn;
    const coverUrl = isbn ? `${COVER_BASE}/${isbn}/cover` : null;

    const card = document.createElement('div');
    card.className = 'book-card reading-card';

    card.innerHTML = `
        <div class="book-cover-container">
            ${coverUrl
        ? `<img src="${coverUrl}" class="book-cover" alt="${reading.book.title}" onerror="this.parentElement.innerHTML='<div class=\\'no-cover-placeholder\\'>Нет обложки</div>'">`
        : `<div class="no-cover-placeholder">Нет ISBN</div>`}
        </div>
        <div class="book-info">
            <div class="reading-card-top">
                <h3>${reading.book.title}</h3>
                <p>${reading.book.author}</p>
            </div>
            <div class="reading-card-bottom">
                <div class="reading-card-meta">
                    <span class="book-meta">${reading.currentPage} / ${reading.book.totalPages} стр.</span>
                    <select class="status-dropdown" title="Сменить статус">
                        ${Object.entries(STATUS_LABELS).map(([val, label]) =>
        `<option value="${val}" ${reading.status === val ? 'selected' : ''}>${label}</option>`
    ).join('')}
                    </select>
                </div>
                ${showProgress ? `
                    <div class="reading-progress">
                        <div class="reading-progress-bar">
                            <div class="reading-progress-fill" style="width:${percent}%"></div>
                        </div>
                        <span class="reading-progress-text">${percent}%</span>
                    </div>
                ` : ''}
                ${showScore ? `<span class="reading-score">⭐ ${reading.score ?? '—'} / 10</span>` : ''}
                ${reading.notes ? `<p class="reading-notes">${reading.notes}</p>` : ''}
                <div class="reading-card-actions">
                    <button class="btn-edit-reading">✏️ Редактировать</button>
                    <button class="btn-delete-reading">🗑️ Удалить</button>
                </div>
            </div>
        </div>
    `;

    card.querySelector('.status-dropdown').addEventListener('change', async (e) => {
        e.stopPropagation();
        const newStatus = e.target.value;
        e.target.value = reading.status;
        await handleStatusChange(reading, newStatus);
    });

    card.querySelector('.btn-edit-reading').addEventListener('click', () => openReadingModal(reading));
    card.querySelector('.btn-delete-reading').addEventListener('click', () => openDeleteReadingModal(reading.id));

    return card;
}

function renderReadingCards(readings) {
    const list = document.getElementById('reading-list');
    list.innerHTML = '';

    if (!readings || readings.length === 0) {
        list.innerHTML = '<p class="empty-msg">Записей не найдено.</p>';
        return;
    }

    readings.forEach(reading => {
        if (!cardCache.has(reading.id)) {
            cardCache.set(reading.id, createReadingCard(reading));
        }
        list.appendChild(cardCache.get(reading.id));
    });
}

async function handleStatusChange(reading, newStatus) {
    if (newStatus === reading.status) return;
    if (newStatus === 'READING') {
        openConfirmRestartModal(reading);
        return;
    }
    openFinishModal(reading, newStatus);
}

function openFinishModal(reading, targetStatus) {
    document.getElementById('finish-modal-title').innerText =
        targetStatus === 'ABANDONED' ? 'Отметить как брошено' : 'Отметить как прочитано';

    document.getElementById('finish-modal-score').value = reading.score ?? '';
    document.getElementById('finish-modal-notes').value = reading.notes ?? '';

    const allPagesRow = document.getElementById('finish-modal-all-pages-row');
    const allPagesCheck = document.getElementById('finish-modal-all-pages');
    if (allPagesRow) {
        allPagesRow.style.display = targetStatus === 'FINISHED' ? 'flex' : 'none';
        if (allPagesCheck) allPagesCheck.checked = false;
    }

    document.getElementById('finish-status-modal').style.display = 'block';

    const form = document.getElementById('finish-status-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const score = parseInt(document.getElementById('finish-modal-score').value);
        const notes = document.getElementById('finish-modal-notes').value || null;
        const allPages = document.getElementById('finish-modal-all-pages')?.checked;

        if (allPages && targetStatus === 'FINISHED') {
            try {
                await authorizedFetch(`${READING_API}/${reading.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({currentPage: reading.book.totalPages})
                });
            } catch (_) {
            }
        }

        try {
            const response = await authorizedFetch(`${READING_API}/${reading.id}/finish`, {
                method: 'POST',
                body: JSON.stringify({score, notes, abandon: targetStatus === 'ABANDONED'})
            });
            await handleResponse(response);
            closeFinishModal();
            showMessage('Статус обновлён', 'success');
            await reloadReadings();
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}

export function closeFinishModal() {
    document.getElementById('finish-status-modal').style.display = 'none';
}

function openConfirmRestartModal(reading) {
    document.getElementById('restart-book-title').innerText = reading.book.title;
    document.getElementById('restart-book-author').innerText = reading.book.author;
    document.getElementById('confirm-restart-modal').style.display = 'block';

    const btn = document.getElementById('confirm-restart-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        closeConfirmRestartModal();
        try {
            await authorizedFetch(`${READING_API}/${reading.id}`, {method: 'DELETE'});
            const response = await authorizedFetch(READING_API, {
                method: 'POST',
                body: JSON.stringify({bookId: reading.book.id})
            });
            const newReading = await handleResponse(response);
            showMessage('Чтение начато заново!', 'success');
            await reloadReadings();
            openReadingModal(newReading);
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}

export function closeConfirmRestartModal() {
    document.getElementById('confirm-restart-modal').style.display = 'none';
}

function openDeleteReadingModal(id) {
    document.getElementById('confirm-delete-reading-modal').style.display = 'block';

    const btn = document.getElementById('confirm-delete-reading-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        document.getElementById('confirm-delete-reading-modal').style.display = 'none';
        try {
            const response = await authorizedFetch(`${READING_API}/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showMessage('Запись удалена', 'success');
                await reloadReadings(true);
            }
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}

export function closeDeleteReadingModal() {
    document.getElementById('confirm-delete-reading-modal').style.display = 'none';
}

export function openReadingModal(reading) {
    document.getElementById('reading-entry-id').value = reading.id;
    document.getElementById('reading-book-title').innerText = reading.book.title;
    document.getElementById('reading-book-author').innerText = reading.book.author;

    const pageInput = document.getElementById('current-page-input');
    pageInput.value = reading.currentPage;
    pageInput.max = reading.book.totalPages;

    updateProgressBar(reading.progressPercentage || 0);

    document.getElementById('reading-modal').style.display = 'block';
    document.getElementById('finish-reading-form').style.display = 'none';
}

export function closeReadingModal() {
    document.getElementById('reading-modal').style.display = 'none';
}

export function openFinishForm() {
    const form = document.getElementById('finish-reading-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function updateProgressBar(percentage) {
    const percent = Math.round(percentage);
    document.getElementById('progress-bar-fill').style.width = percent + '%';
    document.getElementById('progress-text').innerText = percent + '%';
}

export function closeConfirmStartModal() {
    document.getElementById('confirm-start-modal').style.display = 'none';
}

export function initStartReadingModal() {
    const modal = document.getElementById('start-reading-modal');
    const input = document.getElementById('book-search-input');
    const results = document.getElementById('book-search-results');
    let selectedBook = null;

    document.getElementById('open-start-reading').addEventListener('click', () => {
        modal.style.display = 'block';
        input.value = '';
        results.innerHTML = '';
        selectedBook = null;
    });

    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        selectedBook = null;
        const query = input.value.trim();
        if (query.length < 2) {
            results.innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(() => searchBooks(query, results, (book) => {
            selectedBook = book;
        }), 300);
    });

    document.getElementById('start-reading-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedBook) {
            showMessage('Выберите книгу из списка', 'error');
            return;
        }
        const existing = allReadings.find(r => r.book.id === selectedBook.id);
        if (existing) {
            const label = STATUS_LABELS[existing.status] || existing.status;
            showMessage(`Эта книга уже есть в списке со статусом «${label}»`, 'error');
            return;
        }
        closeStartReadingModal();
        document.getElementById('confirm-book-title').innerText = selectedBook.title;
        document.getElementById('confirm-book-author').innerText = selectedBook.author;
        document.getElementById('confirm-start-modal').style.display = 'block';

        const btn = document.getElementById('confirm-start-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async () => {
            closeConfirmStartModal();
            try {
                const response = await authorizedFetch(READING_API, {
                    method: 'POST',
                    body: JSON.stringify({bookId: selectedBook.id})
                });
                const reading = await handleResponse(response);
                showMessage('Чтение начато!', 'success');
                await reloadReadings();
                switchStatus('READING');
                openReadingModal(reading);
            } catch (err) {
                showMessage(err.message, 'error');
            }
        });
    });
}

async function searchBooks(query, resultsEl, onSelect) {
    const input = document.getElementById('book-search-input');
    try {
        const response = await authorizedFetch(`${BOOKS_API}?size=${FETCH_ALL_SIZE}&page=0`);
        const data = await handleResponse(response);
        const books = (data.content || data).filter(b =>
            b.title.toLowerCase().includes(query.toLowerCase()) ||
            b.author.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10);

        resultsEl.innerHTML = '';
        if (!books.length) {
            resultsEl.innerHTML = '<p class="search-empty">Ничего не найдено</p>';
            return;
        }

        books.forEach(book => {
            const item = document.createElement('div');
            item.className = 'book-search-item';
            item.innerHTML = `<strong>${book.title}</strong><span>${book.author}</span>`;
            item.addEventListener('click', () => {
                resultsEl.querySelectorAll('.book-search-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                onSelect(book);
                input.value = `${book.title} — ${book.author}`;
                resultsEl.innerHTML = '';
            });
            resultsEl.appendChild(item);
        });
    } catch (err) {
        resultsEl.innerHTML = `<p class="error" style="padding:10px">${err.message}</p>`;
    }
}

export function closeStartReadingModal() {
    document.getElementById('start-reading-modal').style.display = 'none';
    document.getElementById('start-reading-form').reset();
    document.getElementById('book-search-results').innerHTML = '';
}

export function initReadingFilters() {
    document.querySelectorAll('.reading-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => switchStatus(btn.dataset.status));
    });
}

export function initReadingModal() {
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('confirm-start-modal')) closeConfirmStartModal();
        if (e.target === document.getElementById('finish-status-modal')) closeFinishModal();
        if (e.target === document.getElementById('confirm-restart-modal')) closeConfirmRestartModal();
        if (e.target === document.getElementById('confirm-delete-reading-modal')) closeDeleteReadingModal();
    });

    document.getElementById('update-progress-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reading-entry-id').value;
        const page = parseInt(document.getElementById('current-page-input').value);
        try {
            const response = await authorizedFetch(`${READING_API}/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({currentPage: page})
            });
            const updated = await handleResponse(response);
            document.getElementById('current-page-input').value = updated.currentPage;
            updateProgressBar(updated.progressPercentage || 0);
            closeReadingModal();
            showMessage('Прогресс обновлён', 'success');
            await reloadReadings();
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });

    document.getElementById('finish-reading-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reading-entry-id').value;
        const finishData = {
            score: parseInt(document.getElementById('finish-score').value),
            notes: document.getElementById('finish-notes').value || null,
            abandon: document.getElementById('finish-abandon').checked
        };
        try {
            const response = await authorizedFetch(`${READING_API}/${id}/finish`, {
                method: 'POST',
                body: JSON.stringify(finishData)
            });
            await handleResponse(response);
            closeReadingModal();
            showMessage('Чтение завершено!', 'success');
            await reloadReadings();
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });

    document.getElementById('delete-reading-btn').addEventListener('click', () => {
        const id = document.getElementById('reading-entry-id').value;
        closeReadingModal();
        openDeleteReadingModal(id);
    });
}
