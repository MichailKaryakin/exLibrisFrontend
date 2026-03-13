import {initAuth, toggleAuth} from './auth.js';
import {
    loadBooks, initAddBookModal, closeModal,
    initEditBookModal, closeEditModal,
    initBooksSearch, initBooksPagination
} from './books.js';
import {
    loadAllReadings,
    closeReadingModal, openFinishForm,
    initReadingModal, initStartReadingModal,
    initReadingFilters,
    closeStartReadingModal,
    closeConfirmStartModal,
    closeFinishModal,
    closeConfirmRestartModal,
    closeDeleteReadingModal,
    initReadingSearch
} from './reading.js';
import {handleImgError} from './ui.js';
import {loadStats} from './stats.js';

export function isLoggedIn() {
    return !!localStorage.getItem('accessToken');
}

export function onLoginSuccess() {
    setAuthState(true);
    showSection('nav-books');
    setActiveNav('nav-books');
}

function setAuthState(loggedIn) {
    document.querySelectorAll('.nav-item:not(#nav-home)').forEach(item => {
        item.style.display = loggedIn ? '' : 'none';
    });
    if (!loggedIn) {
        showSectionEl('auth-section');
        setActiveNav('nav-home');
    }
}

const SECTION_MAP = {
    'nav-home': 'auth-section',
    'nav-books': 'books-section',
    'nav-reading': 'reading-section',
    'nav-stats': 'stats-section',
};

export let sectionShownAt = 0;

function showSectionEl(sectionId) {
    Object.values(SECTION_MAP).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        sectionShownAt = Date.now();
    }
}

function showSection(navId) {
    if (!isLoggedIn() && navId !== 'nav-home') return;
    showSectionEl(SECTION_MAP[navId]);
    switch (navId) {
        case 'nav-books':
            loadBooks();
            break;
        case 'nav-reading':
            loadAllReadings();
            break;
        case 'nav-stats':
            loadStats();
            break;
    }
}

function setActiveNav(navId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const el = document.getElementById(navId);
    if (el) el.classList.add('active');
}

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (!isLoggedIn() && item.id !== 'nav-home') return;
            setActiveNav(item.id);
            showSection(item.id);
        });
    });
}

function closeConfirmDeleteModal() {
    document.getElementById('confirm-delete-modal').style.display = 'none';
}

window.toggleAuth = toggleAuth;
window.closeModal = closeModal;
window.closeReadingModal = closeReadingModal;
window.openFinishForm = openFinishForm;
window.handleImgError = handleImgError;
window.closeStartReadingModal = closeStartReadingModal;
window.closeConfirmStartModal = closeConfirmStartModal;
window.closeConfirmDeleteModal = closeConfirmDeleteModal;
window.closeEditModal = closeEditModal;
window.closeFinishModal = closeFinishModal;
window.closeConfirmRestartModal = closeConfirmRestartModal;
window.closeDeleteReadingModal = closeDeleteReadingModal;

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirm-delete-modal')) closeConfirmDeleteModal();
});

window.addEventListener('auth:expired', () => {
    localStorage.clear();
    setAuthState(false);
});

function init() {
    initNavigation();
    initAuth(onLoginSuccess);
    initAddBookModal();
    initEditBookModal();
    initBooksSearch();
    initBooksPagination();
    initReadingModal();
    initStartReadingModal();
    initReadingFilters();
    initReadingSearch();

    if (isLoggedIn()) {
        setAuthState(true);
        showSection('nav-books');
        setActiveNav('nav-books');
    } else {
        setAuthState(false);
    }
}

document.addEventListener('DOMContentLoaded', init);
