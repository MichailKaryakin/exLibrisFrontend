export function showMessage(text, type = 'info') {
    const msgDiv = document.getElementById('auth-message');
    msgDiv.innerText = text;
    msgDiv.className = 'message ' + type;

    clearTimeout(msgDiv._hideTimer);
    msgDiv._hideTimer = setTimeout(() => {
        msgDiv.innerText = '';
        msgDiv.className = 'message';
    }, 4000);
}

export function handleImgError(image) {
    image.onerror = null;
    image.style.display = 'none';
    image.parentElement.innerHTML = `<div class="no-cover-placeholder">Обложка не найдена</div>`;
}
