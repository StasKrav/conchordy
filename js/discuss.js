// Модальное окно для публичного обсуждения
async function showDiscussModal(postId, postTitle) {
  // Загружаем существующие сообщения
  let discussions = [];
  try {
    const response = await fetch(`${API_BASE}/post-discussions/${postId}`);
    if (response.ok) {
      discussions = await response.json();
      console.log(
        `💬 Загружено ${discussions.length} сообщений для поста ${postId}`,
      );
    }
  } catch (e) {
    console.error("Ошибка загрузки обсуждений:", e);
  }

  const modal = document.createElement("div");
  modal.className = "discuss-modal-overlay";
  modal.innerHTML = `
      <div class="discuss-modal">
        <div class="discuss-modal-header">
          <div class="discuss-modal-title">
            <i class="fa-regular fa-comments"></i>
            <span>Обсуждение</span>
          </div>
          <button class="discuss-modal-close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 6 6 18"/>
                              <path d="m6 6 12 12"/>
                            </svg>
          </button>
        </div>
        
        <div class="discuss-modal-post-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22 6 12 13 2 6"/>
          </svg>
          <span>${escapeHtml(postTitle)}</span>
        </div>
        
        <div class="discuss-modal-messages" id="discussMessagesList"></div>
        
        <div class="discuss-modal-footer">
          <textarea id="discussMessage" rows="3" placeholder="Напишите своё мнение, вопрос или предложение..."></textarea>
          <button id="sendDiscussBtn" class="discuss-send-btn">
            <i class="fa-regular fa-paper-plane"></i> Отправить
          </button>
        </div>
      </div>
    `;
  document.body.appendChild(modal);

  // Рендерим сообщения
  const messagesContainer = modal.querySelector("#discussMessagesList");

  function renderMessages() {
    if (discussions.length === 0) {
      messagesContainer.innerHTML = `
          <div class="discuss-message system">
            <div class="discuss-message-avatar">
            </div>
            <div class="discuss-message-content">
              <div class="discuss-message-text">Здесь будут публичные комментарии всех участников. Обсуждайте трек, задавайте вопросы автору, делитесь идеями!</div>
            </div>
          </div>
        `;
      return;
    }

    messagesContainer.innerHTML = discussions
      .map((msg) => {
        const isCurrentUser = currentUser && msg.user_id === currentUser.id;
        return `
          <div class="discuss-message ${isCurrentUser ? "my-message" : ""}" data-message-id="${msg.id}">
            <div class="discuss-message-avatar">
              <div class="default-avatar-small">${(msg.user_name || "?").charAt(0)}</div>
            </div>
            <div class="discuss-message-content">
              <div class="discuss-message-author">
                ${escapeHtml(msg.user_name || "Участник")}
                <span class="discuss-message-time">${formatMessageTime(msg.created_at)}</span>
                ${
                  isCurrentUser
                    ? `
                  <button class="discuss-message-delete" data-message-id="${msg.id}" title="Удалить сообщение">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                `
                    : ""
                }
              </div>
              <div class="discuss-message-text">${escapeHtml(msg.message)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    // Добавляем обработчики для кнопок удаления
    messagesContainer
      .querySelectorAll(".discuss-message-delete")
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const messageId = btn.getAttribute("data-message-id");

          showConfirmModal({
            title: "Удаление сообщения",
            message: "Вы уверены, что хотите удалить это сообщение?",
            confirmText: "Удалить",
            cancelText: "Отмена",
            onConfirm: async () => {
              try {
                const response = await fetch(
                  `${API_BASE}/post-discussions/${messageId}`,
                  {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: currentUser.id }),
                  },
                );

                if (response.ok) {
                  discussions = discussions.filter((m) => m.id != messageId);
                  renderMessages();
                } else {
                  const error = await response.json();
                  alert("Ошибка: " + (error.error || "Не удалось удалить"));
                }
              } catch (e) {
                console.error("Ошибка удаления:", e);
                alert("Ошибка соединения");
              }
            },
          });
        });
      });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  renderMessages();

  // Закрытие
  const closeBtn = modal.querySelector(".discuss-modal-close");
  const closeModal = () => modal.remove();
  closeBtn.onclick = closeModal;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Отправка сообщения
  const textarea = modal.querySelector("#discussMessage");
  const sendBtn = modal.querySelector("#sendDiscussBtn");

  const sendMessage = async () => {
    const message = textarea.value.trim();
    if (!message) {
      textarea.style.borderColor = "#c2410c";
      textarea.placeholder = "Пожалуйста, напишите сообщение";
      setTimeout(() => {
        textarea.style.borderColor = "";
        textarea.placeholder =
          "Напишите своё мнение, вопрос или предложение...";
      }, 2000);
      return;
    }

    if (!currentUser) {
      alert("Войдите в аккаунт, чтобы участвовать в обсуждении");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/post-discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          user_id: currentUser.id,
          message: message,
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        discussions.push(newMessage);
        renderMessages();
        textarea.value = "";
        textarea.style.height = "auto";
      } else {
        const error = await response.json();
        alert("Ошибка: " + (error.error || "Не удалось отправить сообщение"));
      }
    } catch (e) {
      console.error("Ошибка отправки:", e);
      alert("Ошибка соединения");
    }
  };

  sendBtn.onclick = sendMessage;
  textarea.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      sendMessage();
    }
  });

  // Автоматический рост текстового поля
  textarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });
}
