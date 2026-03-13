import {BOOKS_API, READING_API, authorizedFetch, handleResponse} from './api.js';
import {showMessage} from './ui.js';
import {openReadingModal} from './reading.js';
import {sectionShownAt} from './app.js';

const PAGE_SIZE = 12;
const FETCH_ALL_SIZE = 2000;

let allBooks = [];
let filteredBooks = [];
let currentPage = 0;
let currentSearch = '';
let currentSeries = '';
const cardCache = new Map();

export async function loadBooks(force = false, preservePage = false) {
    if (allBooks.length > 0 && !force) {
        applyFilters(preservePage);
        return;
    }

    if (force) cardCache.clear();

    const grid = document.getElementById('books-grid');
    grid.innerHTML = '<p class="loading-msg">Загрузка библиотеки...</p>';

    try {
        const response = await authorizedFetch(`${BOOKS_API}?size=${FETCH_ALL_SIZE}&page=0`);
        const pageData = await handleResponse(response);
        allBooks = pageData.content || [];
        applyFilters(preservePage);
        renderSeriesFilter();
    } catch (err) {
        grid.innerHTML = `<p class="error">Ошибка загрузки: ${err.message}</p>`;
    }
}

function applyFilters(preservePage = false) {
    const q = currentSearch.toLowerCase();

    filteredBooks = allBooks.filter(book => {
        const matchSearch = !q || [book.title, book.author, book.isbn, book.series]
            .some(field => field && field.toLowerCase().includes(q));
        const matchSeries = !currentSeries || book.series === currentSeries;
        return matchSearch && matchSeries;
    });

    if (!preservePage) {
        currentPage = 0;
    } else {
        const totalPages = Math.ceil(filteredBooks.length / PAGE_SIZE);
        if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
    }

    renderPage();
}

function renderPage() {
    const start = currentPage * PAGE_SIZE;
    renderBookCards(filteredBooks.slice(start, start + PAGE_SIZE));
    updatePaginationUI();
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.id = `book-${book.id}`;
    card.addEventListener('click', () => handleBookClick(book.id, book.title, book.author));

    const coverUrl = book.isbn ? `http://localhost:8080/api/books/isbn/${book.isbn}/cover` : '';

    card.innerHTML = `
        <button class="btn-delete" title="Удалить">&times;</button>
        <div class="book-cover-container">
            ${book.isbn
        ? `<img src="${coverUrl}" class="book-cover" alt="${book.title}" onerror="handleImgError(this)">`
        : `<div class="no-cover-placeholder">Нет ISBN</div>`}
        </div>
        <div class="book-info">
            <div class="book-info-main">
                <h3>${book.title}</h3>
                ${book.series ? `<span class="book-series">${book.series}</span>` : ''}
            </div>
            <div class="book-info-footer">
                <p>${book.author}</p>
                <span class="book-meta">${book.totalPages} стр.</span>
            </div>
        </div>
    `;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-book';
    editBtn.title = 'Редактировать';
    editBtn.innerHTML = '✏️';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditBookModal(book);
    });
    card.appendChild(editBtn);

    card.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBook(book.id);
    });

    return card;
}

function renderBookCards(books) {
    const grid = document.getElementById('books-grid');
    grid.innerHTML = '';

    if (!books || books.length === 0) {
        grid.innerHTML = '<p class="empty-msg">Ничего не найдено.</p>';
        return;
    }

    books.forEach(book => {
        if (!cardCache.has(book.id)) {
            cardCache.set(book.id, createBookCard(book));
        }
        grid.appendChild(cardCache.get(book.id));
    });
}

function updatePaginationUI() {
    const totalPages = Math.ceil(filteredBooks.length / PAGE_SIZE);
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

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

export function initBooksPagination() {
}

let searchTimeout = null;

export function initBooksSearch() {
    const input = document.getElementById('books-search-input');
    const isbnBtn = document.getElementById('isbn-search-btn');
    const isbnInput = document.getElementById('isbn-search-input');
    const isbnResetBtn = document.getElementById('isbn-reset-btn');

    if (!input) return;

    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = input.value.trim();
            applyFilters();
        }, 200);
    });

    if (isbnBtn && isbnInput) {
        isbnBtn.addEventListener('click', () => searchByIsbn(isbnInput.value.trim()));
        isbnInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchByIsbn(isbnInput.value.trim());
        });
    }

    if (isbnResetBtn) {
        isbnResetBtn.addEventListener('click', () => {
            isbnInput.value = '';
            currentSearch = '';
            document.getElementById('books-search-input').value = '';
            applyFilters();
        });
    }
}

async function searchByIsbn(isbn) {
    if (!isbn) return;
    try {
        const response = await authorizedFetch(`${BOOKS_API}/isbn/${isbn}`);
        const book = await handleResponse(response);
        currentSearch = '';
        currentSeries = '';
        document.getElementById('books-search-input').value = '';
        renderBookCards([book]);
        document.getElementById('page-info').innerText = 'Результат поиска по ISBN';
        document.getElementById('prev-page').disabled = true;
        document.getElementById('next-page').disabled = true;
    } catch (err) {
        showMessage('Книга с таким ISBN не найдена', 'error');
    }
}

function renderSeriesFilter() {
    const container = document.getElementById('series-filter-container');
    if (!container) return;

    const series = [...new Set(allBooks.map(b => b.series).filter(Boolean))].sort();

    if (series.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="series-filters">
            <button class="series-filter-btn active" data-series="">Все</button>
            ${series.map(s => `<button class="series-filter-btn" data-series="${s}">${s}</button>`).join('')}
        </div>
    `;

    container.querySelectorAll('.series-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.series-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSeries = btn.dataset.series;
            applyFilters();
        });
    });
}

async function handleBookClick(bookId, bookTitle, bookAuthor) {
    try {
        const response = await authorizedFetch(READING_API);
        const pageData = await handleResponse(response);
        const readings = pageData.content || pageData;
        const existing = readings.find(r => r.book.id === bookId);

        if (existing) {
            openReadingModal(existing);
            return;
        }

        document.getElementById('confirm-book-title').innerText = bookTitle;
        document.getElementById('confirm-book-author').innerText = bookAuthor;
        document.getElementById('confirm-start-modal').style.display = 'block';

        const btn = document.getElementById('confirm-start-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async () => {
            document.getElementById('confirm-start-modal').style.display = 'none';
            try {
                const startRes = await authorizedFetch(READING_API, {
                    method: 'POST',
                    body: JSON.stringify({bookId})
                });
                const reading = await handleResponse(startRes);
                openReadingModal(reading);
                showMessage('Чтение начато!', 'success');
            } catch (err) {
                showMessage(err.message, 'error');
            }
        });
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

export function initAddBookModal() {
    document.getElementById('open-add-modal').onclick = () => {
        document.getElementById('add-book-modal').style.display = 'block';
    };

    document.getElementById('add-book-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const bookData = {
            title: document.getElementById('add-title').value,
            author: document.getElementById('add-author').value,
            year: parseInt(document.getElementById('add-year').value) || null,
            totalPages: parseInt(document.getElementById('add-pages').value),
            isbn: document.getElementById('add-isbn').value || null,
            series: document.getElementById('add-series').value || null,
            description: document.getElementById('add-description').value || null
        };

        try {
            const response = await authorizedFetch(BOOKS_API, {
                method: 'POST',
                body: JSON.stringify(bookData)
            });
            await handleResponse(response);
            showMessage('Книга успешно добавлена!', 'success');
            closeModal();
            loadBooks(true);
        } catch (err) {
            showMessage('Ошибка: ' + err.message, 'error');
        }
    });
}

export function closeModal() {
    document.getElementById('add-book-modal').style.display = 'none';
    document.getElementById('add-book-form').reset();
}

function openEditBookModal(book) {
    document.getElementById('edit-book-id').value = book.id;
    document.getElementById('edit-title').value = book.title || '';
    document.getElementById('edit-author').value = book.author || '';
    document.getElementById('edit-year').value = book.year || '';
    document.getElementById('edit-pages').value = book.totalPages || '';
    document.getElementById('edit-isbn').value = book.isbn || '';
    document.getElementById('edit-series').value = book.series || '';
    document.getElementById('edit-description').value = book.description || '';
    document.getElementById('edit-book-modal').style.display = 'block';
}

export function closeEditModal() {
    document.getElementById('edit-book-modal').style.display = 'none';
    document.getElementById('edit-book-form').reset();
}

export function initEditBookModal() {
    document.getElementById('edit-book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-book-id').value;

        const bookData = {
            title: document.getElementById('edit-title').value || null,
            author: document.getElementById('edit-author').value || null,
            year: parseInt(document.getElementById('edit-year').value) || null,
            totalPages: parseInt(document.getElementById('edit-pages').value) || null,
            isbn: document.getElementById('edit-isbn').value || null,
            series: document.getElementById('edit-series').value || null,
            description: document.getElementById('edit-description').value || null
        };

        try {
            const response = await authorizedFetch(`${BOOKS_API}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(bookData)
            });
            await handleResponse(response);
            showMessage('Книга обновлена!', 'success');
            closeEditModal();
            loadBooks(true, true);
        } catch (err) {
            showMessage('Ошибка: ' + err.message, 'error');
        }
    });
}

async function deleteBook(id) {
    document.getElementById('confirm-delete-modal').style.display = 'block';

    const btn = document.getElementById('confirm-delete-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        document.getElementById('confirm-delete-modal').style.display = 'none';
        try {
            const response = await authorizedFetch(`${BOOKS_API}/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showMessage('Книга удалена', 'success');
                loadBooks(true, true);
            } else {
                const data = await response.json();
                throw new Error(data.message || 'Ошибка удаления');
            }
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}
