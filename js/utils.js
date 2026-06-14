// Склонение числительных
function getDeclension(number, one, two, five) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getDate()} ${date.toLocaleString("ru", { month: "short" })} · ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, (m) =>
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
  );
}

// Вспомогательная функция форматирования времени для сообщений
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} д назад`;
  return `${date.getDate()} ${date.toLocaleString("ru", { month: "short" })}`;
}

// Модальное окно подтверждения
function showConfirmModal(options) {
  const { title, message, confirmText, cancelText, onConfirm, onCancel } =
    options;

  const overlay = document.createElement("div");
  overlay.className = "confirm-modal-overlay";
  overlay.innerHTML = `
            <div class="confirm-modal">
              <div class="confirm-modal-header">
                <div class="confirm-modal-title">
                  <i class="fa-regular fa-circle-question"></i>
                  <span>${escapeHtml(title || "Подтверждение")}</span>
                </div>
              </div>
              <div class="confirm-modal-body">
                <p>${escapeHtml(message || "Вы уверены?")}</p>
              </div>
              <div class="confirm-modal-footer">
                <button class="confirm-modal-cancel">${escapeHtml(cancelText || "Отмена")}</button>
                <button class="confirm-modal-ok">${escapeHtml(confirmText || "Удалить")}</button>
              </div>
            </div>
          `;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();

  overlay.querySelector(".confirm-modal-cancel").onclick = () => {
    closeModal();
    if (onCancel) onCancel();
  };

  overlay.querySelector(".confirm-modal-ok").onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
}

function showChatModal(authorId, authorName) {
  const modal = document.createElement("div");
  modal.className = "chat-modal";
  modal.innerHTML = `
            <div class="chat-modal-card">
              <h3 style="margin-bottom: 8px;">Сообщение для ${escapeHtml(authorName)}</h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Ваше сообщение будет отправлено автору объявления</p>
              <textarea id="chatMessage" rows="4" placeholder="Напишите своё предложение, вопрос или приглашение..."></textarea>
              <div style="display: flex; gap: 12px; margin-top: 12px;">
                <button id="sendChatBtn" class="btn-primary" style="flex:1;">Отправить</button>
                <button id="cancelChatBtn" class="btn-secondary" style="flex:1;">Отмена</button>
              </div>
            </div>
          `;
  document.body.appendChild(modal);
  modal.style.display = "flex";

  document.getElementById("sendChatBtn").onclick = () => {
    const message = document.getElementById("chatMessage").value.trim();
    if (!message) {
      alert("Введите сообщение");
      return;
    }
    sendMessageToAuthor(authorId, authorName, message);
    modal.remove();
  };

  document.getElementById("cancelChatBtn").onclick = () => {
    modal.remove();
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}
