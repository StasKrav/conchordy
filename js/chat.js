// ========== ЧАТЫ ==========

let currentChatUserId = null;
let chatMessages = [];
let dialogs = [];

// Рендер списка диалогов
async function renderChatScreen() {
  const container = document.getElementById('chatScreen');
  if (!container) return;
  
  if (!currentUser) {
    container.innerHTML = '<div class="chat-container"><p style="text-align:center;padding:40px;">Войдите в аккаунт</p></div>';
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/dialogs/${currentUser.id}`);
    if (response.ok) {
      dialogs = await response.json();
    }
  } catch (e) {
    console.error('Ошибка загрузки диалогов:', e);
    dialogs = [];
  }
  
  if (dialogs.length === 0) {
    container.innerHTML = `
      <div class="chat-container">
        <div style="text-align:center;padding:40px;color:var(--text-secondary);">
          <i class="fa-regular fa-message" style="font-size:48px;display:block;margin-bottom:16px;"></i>
          <p>Нет сообщений</p>
          <small>Напишите кому-нибудь из профиля или поста</small>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-dialogs-list">
        ${dialogs.map(dialog => `
          <div class="chat-dialog-item" data-user-id="${dialog.user_id}">
            <div class="chat-dialog-avatar">${(dialog.user_name || '?').charAt(0)}</div>
            <div class="chat-dialog-info">
              <div class="chat-dialog-name">${escapeHtml(dialog.user_name)}</div>
              <div class="chat-dialog-last">${dialog.last_message ? escapeHtml(dialog.last_message) : 'Начать диалог'}</div>
            </div>
            ${dialog.unread_count > 0 ? `<div class="chat-dialog-unread">${dialog.unread_count}</div>` : ''}
            <div class="chat-dialog-time">${dialog.last_message_time ? formatMessageTime(dialog.last_message_time) : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Обработчики клика по диалогу
  container.querySelectorAll('.chat-dialog-item').forEach(el => {
    el.addEventListener('click', () => {
      const userId = el.getAttribute('data-user-id');
      openChatRoom(userId);
    });
  });
}

// Открыть чат с пользователем
async function openChatRoom(userId) {
  currentChatUserId = userId;
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  const container = document.getElementById('chatScreen');
  if (!container) return;
  
  // Загружаем сообщения
  try {
    const response = await fetch(`${API_BASE}/messages/${currentUser.id}/${userId}`);
    if (response.ok) {
      chatMessages = await response.json();
    }
  } catch (e) {
    console.error('Ошибка загрузки сообщений:', e);
    chatMessages = [];
  }
  
  renderChatRoom(container, user);
}

// Рендер окна чата
function renderChatRoom(container, user) {
  container.innerHTML = `
    <div class="chat-room">
      <div class="chat-room-header">
        <button class="back-to-profile-btn" id="backToDialogsBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="chat-dialog-avatar">${user.name.charAt(0)}</div>
        <div class="chat-room-name">${escapeHtml(user.name)}</div>
        <button id="videoCallFromChatBtn" class="video-call-btn">
          Видео-звонок
        </button>
      </div>
      
      <div class="chat-messages" id="chatMessagesContainer"></div>
      
      <div class="chat-input-area">
        <input type="text" id="chatMessageInput" placeholder="Напишите сообщение...">
        <button id="chatSendBtn"><i class="fa-regular fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  
  // Заполняем сообщения
  const messagesContainer = document.getElementById('chatMessagesContainer');
  chatMessages.forEach(msg => {
    addMessageToUI(msg, messagesContainer);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Обработчики
  document.getElementById('backToDialogsBtn').onclick = () => {
    currentChatUserId = null;
    renderChatScreen();
  };
  
  document.getElementById('videoCallFromChatBtn').onclick = async () => {
    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    
    try {
      const response = await fetch(`${API_BASE}/video-calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: callId,
          creator_id: currentUser.id,
          participant_id: user.id
        })
      });
      
      if (response.ok) {
        // Отправляем ссылку в чат
        const link = `${window.location.origin}/index.html?room=${callId}`;
        await sendChatMessage(user.id, `Присоединяйся к видео-звонку: ${link}`);
        
        // Открываем видео-комнату
        startVideoLesson(callId, true, user.name, null);
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка создания звонка');
    }
  };
  
  const input = document.getElementById('chatMessageInput');
  const sendBtn = document.getElementById('chatSendBtn');
  
  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;
    
    const success = await sendChatMessage(user.id, text);
    if (success) {
      input.value = '';
    }
  };
  
  sendBtn.onclick = sendMessage;
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// Отправить сообщение
async function sendChatMessage(toUserId, text) {
  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_user_id: currentUser.id,
        to_user_id: toUserId,
        message: text
      })
    });
    
    if (response.ok) {
      const newMsg = await response.json();
      chatMessages.push(newMsg);
      
      const container = document.getElementById('chatMessagesContainer');
      if (container) {
        addMessageToUI(newMsg, container);
        container.scrollTop = container.scrollHeight;
      }
      
      // Обновляем список диалогов в фоне
      updateDialogs();
      return true;
    }
  } catch (e) {
    console.error('Ошибка отправки:', e);
  }
  return false;
}

// Добавить сообщение в UI
function addMessageToUI(msg, container) {
  const isSent = msg.from_user_id === currentUser.id;
  const div = document.createElement('div');
  div.className = `chat-message ${isSent ? 'sent' : 'received'}`;
  div.innerHTML = `
    ${escapeHtml(msg.message)}
    <span class="chat-message-time">${formatMessageTime(msg.created_at)}</span>
  `;
  container.appendChild(div);
}

// Обновить список диалогов
async function updateDialogs() {
  if (!currentChatUserId) return;
  try {
    const response = await fetch(`${API_BASE}/dialogs/${currentUser.id}`);
    if (response.ok) {
      dialogs = await response.json();
    }
  } catch (e) {}
}
