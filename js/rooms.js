// ========== АУДИО-КОМНАТЫ ==========

let currentRoom = null;
let currentSocket = null;
let activeRoomsList = [];

// Показать модальное окно создания комнаты
function showCreateRoomModal() {
  const modalHtml = `
      <div class="modal" id="createRoomModal" style="display: flex;">
        <div class="modal-card">
          <h3>Начать эфир</h3>
          <div class="form-group">
            <label>Название эфира</label>
            <input type="text" id="roomTitle" placeholder="например: Акустический вечер">
          </div>
          <div class="form-group">
            <label>Описание (необязательно)</label>
            <textarea id="roomDesc" rows="2" placeholder="Кратко о том, что будет..."></textarea>
          </div>
          <div class="modal-buttons">
            <button class="btn-secondary" id="cancelRoomBtn">Отмена</button>
            <button class="btn-primary" id="createRoomBtn">Создать комнату</button>
          </div>
        </div>
      </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("createRoomModal");

  document.getElementById("cancelRoomBtn").onclick = () => modal.remove();
  document.getElementById("createRoomBtn").onclick = async () => {
    const title = document.getElementById("roomTitle").value.trim();
    if (!title) {
      alert("Введите название эфира");
      return;
    }
    const description = document.getElementById("roomDesc").value.trim();

    try {
      const response = await fetch(`${API_BASE}/live-rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_id: currentUser.id,
          title: title,
          description: description,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        modal.remove();
        // Открываем созданную комнату
        openRoom(result.roomId, true);
      } else {
        alert("Ошибка создания комнаты");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка соединения");
    }
  };
}

// Открыть комнату
async function openRoom(roomId, isHost = false) {
  // Скрываем кнопку создания поста
  const fab = document.getElementById("fabBtn");
  if (fab) fab.style.display = "none";
  try {
    const response = await fetch(`${API_BASE}/live-rooms/${roomId}`);
    if (!response.ok) throw new Error("Комната не найдена");
    const room = await response.json();
    currentRoom = room;

    // Загружаем сообщения чата
    const messagesResponse = await fetch(`${API_BASE}/room-messages/${roomId}`);
    const messages = await messagesResponse.json();

    // Загружаем донаты
    const donationsResponse = await fetch(
      `${API_BASE}/room-donations/${roomId}`,
    );
    const donations = await donationsResponse.json();

    renderRoomScreen(room, isHost, messages, donations);
    setActiveScreen("room");

    // Подключаем WebSocket
    initRoomSocket(roomId, isHost);
  } catch (e) {
    console.error(e);
    alert("Не удалось загрузить комнату");
  }
}

// Инициализация WebSocket для комнаты
function initRoomSocket(roomId, isHost) {
  if (currentSocket) {
    currentSocket.disconnect();
  }

  currentSocket = io();

  currentSocket.on("connect", () => {
    console.log("🔗 WebSocket подключён");
    currentSocket.emit("join-room", roomId, currentUser.id, currentUser.name);
  });

  // Обработка сигналов WebRTC
  currentSocket.on("webrtc-offer", async (data) => {
    if (!isHost && data.targetId === currentUser.id) {
      console.log("📡 Получен offer, создаём answer");

      const peer = new SimplePeer({ trickle: false });

      peer.on("signal", (signalData) => {
        currentSocket.emit("webrtc-answer", {
          roomId: roomId,
          signal: signalData,
          targetId: data.from,
        });
      });

      peer.on("stream", (stream) => {
        console.log("🎧 Аудио поток получен!");
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 0.8;

        const audioStatus = document.getElementById("audioStatus");
        if (audioStatus) {
          audioStatus.innerHTML =
            '<i class="fa-solid fa-headphones"></i> 🎵 Трансляция идёт';
          audioStatus.style.color = "#2f6b47";
        }
      });

      peer.signal(data.signal);
      peerInstances.set("listener", peer);
    }
  });

  currentSocket.on("webrtc-answer", (data) => {
    if (isHost && data.targetId === currentUser.id) {
      console.log("📡 Получен answer");
      const peer = peerInstances.get(data.from);
      if (peer) {
        peer.signal(data.signal);
      }
    }
  });

  currentSocket.on("broadcast-started", () => {
    if (!isHost) {
      console.log("🎙️ Трансляция начата, соединяемся...");
      joinBroadcast(currentRoom.host_id);
    }
  });

  currentSocket.on("broadcast-stopped", () => {
    if (!isHost) {
      console.log("🔇 Трансляция остановлена");
      leaveBroadcast();
    }
  });

  currentSocket.on("listener-ready", (data) => {
    if (isHost && isBroadcasting) {
      console.log(`👂 Новый слушатель: ${data.userName}, создаём peer`);
      createPeerForListener(data.userId, data.userName);
    }
  });

  currentSocket.on("new-chat-message", (data) => {
    if (data.user_id !== currentUser.id) {
      addRoomMessageToUI(data);
    }
  });

  currentSocket.on("new-donation", (data) => {
    addDonationToUI(data);
  });

  currentSocket.on("user-joined", (data) => {
    addSystemMessageToUI(`${data.userName} присоединился к эфиру`);
    updateRoomListenersCount();

    // Если хост уже вещает, сообщаем новому слушателю
    if (isHost && isBroadcasting && currentSocket) {
      currentSocket.emit("listener-ready", {
        userId: data.userId,
        userName: data.userName,
      });
    }
  });

  currentSocket.on("user-left", (data) => {
    addSystemMessageToUI(`${data.userName} покинул эфир`);
    updateRoomListenersCount();
  });
}

// Рендер страницы комнаты
function renderRoomScreen(room, isHost, messages, donations) {
  const container = document.getElementById("roomScreen");
  if (!container) return;

  const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);

  container.innerHTML = `
      <div class="room-container">
        <div style="margin-bottom: 12px;">
          <button id="backFromRoomBtn" class="back-to-profile-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
          </button>
        </div>
        
        <div class="room-header">
          <div class="room-title">${escapeHtml(room.title)}</div>
          <div class="room-host">Ведущий: ${escapeHtml(room.host_name)}</div>
          <div class="room-stats">
            <span><span id="listenersCount">${room.listeners_count || 0}</span> слушателей</span>
            <span>💰 <span id="donationsTotal">${totalDonations}</span> ₽ собрано</span>
          </div>
        </div>
        
        <div class="room-player">
          <div class="room-player-avatar">${room.host_name.charAt(0)}</div>
          <div class="room-player-status">
            <span class="pulse-dot"></span>
            ${isHost ? "Вы в эфире" : "Слушаем"}
          </div>
          ${!isHost ? `<button class="donate-btn" id="donateBtn"><i class="fa-regular fa-heart"></i> Поддержать</button>` : ""}
        </div>

        <div class="audio-controls">
          ${
            isHost
              ? `
                    <div class="audio-controls">
                      <button id="testMicBtn" class="audio-btn audio-btn-test">
                        <i class="fa-solid fa-ear-listen"></i> Проверить микрофон
                      </button>
                    </div>
                    <div class="mic-test-indicator" id="micTestIndicator" style="display: none;">
                      <i class="fa-solid fa-waveform"></i>
                      <span>Тест микрофона</span>
                      <div class="volume-indicator">
                        <div class="volume-level" id="volumeLevel"></div>
                      </div>
                    </div>
                  `
              : ""
          }
          ${
            isHost
              ? `
            <div class="room-controls-row">
              <button id="startBroadcastBtn" class="room-control-btn room-control-start">
                <i class="fa-solid fa-microphone"></i> Начать эфир
              </button>
              <button id="pauseBroadcastBtn" class="room-control-btn room-control-pause" disabled>
                <i class="fa-solid fa-microphone-slash"></i> Пауза
              </button>
              <button id="endRoomBtn" class="room-control-btn room-control-end">
                <i class="fa-regular fa-circle-xmark"></i> Завершить эфир
              </button>
            </div>
          `
              : ""
          }
        
        
        <div class="room-chat">
          <div class="room-chat-messages" id="roomChatMessages"></div>
          <div class="room-chat-input">
            <input type="text" id="roomChatInput" placeholder="Напишите сообщение...">
            <button id="roomChatSendBtn"><i class="fa-regular fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    `;

  // Заполняем чат историей
  const chatContainer = container.querySelector("#roomChatMessages");
  messages.forEach((msg) => {
    addRoomMessageToUI(msg, chatContainer, false);
  });

  // Добавляем донаты в UI
  donations.forEach((donation) => {
    addDonationToUI(donation, chatContainer, false);
  });

  // Обработчики
  document.getElementById("backFromRoomBtn").onclick = () => {
    if (currentSocket) {
      currentSocket.emit(
        "leave-room",
        room.id,
        currentUser.id,
        currentUser.name,
      );
      currentSocket.disconnect();
      currentSocket = null;
    }
    currentRoom = null;

    // Показываем кнопку создания поста
    const fab = document.getElementById("fabBtn");
    if (fab) fab.style.display = "flex";

    setActiveScreen("feed");
    renderFeed();
  };

  const chatInput = document.getElementById("roomChatInput");
  const chatSendBtn = document.getElementById("roomChatSendBtn");

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const response = await fetch(`${API_BASE}/room-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: room.id,
          user_id: currentUser.id,
          message: message,
        }),
      });
      if (response.ok) {
        const newMsg = await response.json();
        // Добавляем сообщение в UI для себя (один раз)
        addRoomMessageToUI(newMsg);
        chatInput.value = "";

        // Отправляем через WebSocket для всех остальных
        if (currentSocket) {
          currentSocket.emit("chat-message", { ...newMsg, roomId: room.id });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  chatSendBtn.onclick = sendMessage;
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  const donateBtn = document.getElementById("donateBtn");
  if (donateBtn) {
    donateBtn.onclick = () => showDonateModal(room.id, room.host_id);
  }

  const endRoomBtn = document.getElementById("endRoomBtn");
  if (endRoomBtn) {
    endRoomBtn.onclick = async () => {
      if (confirm("Завершить эфир?")) {
        await fetch(`${API_BASE}/live-rooms/${room.id}/end`, { method: "PUT" });
        if (currentSocket) {
          currentSocket.emit(
            "leave-room",
            room.id,
            currentUser.id,
            currentUser.name,
          );
          currentSocket.disconnect();
        }
        setActiveScreen("feed");
        renderFeed();
      }
    };
  }

  const startRoomBtn = document.getElementById("startRoomBtn");
  if (startRoomBtn) {
    startRoomBtn.onclick = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/live-rooms/${room.id}/start`,
          {
            method: "PUT",
          },
        );
        if (response.ok) {
          // Обновляем UI
          const statusDiv = document.querySelector(".room-player-status");
          if (statusDiv) {
            statusDiv.innerHTML = '<span class="pulse-dot"></span> Эфир идёт';
          }
          startRoomBtn.style.display = "none";

          // Показываем уведомление
          alert(
            "🎸 Эфир начат! Комната появится в ленте у всех пользователей.",
          );

          // Обновляем статус комнаты в памяти
          room.status = "live";
        } else {
          alert("Ошибка начала эфира");
        }
      } catch (e) {
        console.error(e);
        alert("Ошибка соединения");
      }
    };
  }

  // Аудио-кнопки
  if (isHost) {
    const startBroadcastBtn = document.getElementById("startBroadcastBtn");
    const pauseBroadcastBtn = document.getElementById("pauseBroadcastBtn");
    const endRoomBtn = document.getElementById("endRoomBtn");

    if (startBroadcastBtn) {
      startBroadcastBtn.onclick = () => startBroadcast(room.id);
    }

    if (pauseBroadcastBtn) {
      pauseBroadcastBtn.onclick = () => pauseBroadcast();
    }

    if (endRoomBtn) {
      endRoomBtn.onclick = () => endBroadcast();
    }
  }

  const testMicBtn = document.getElementById("testMicBtn");
  if (testMicBtn) {
    testMicBtn.onclick = () => testMicrophone();
  }
}

// Добавить сообщение в UI чата
function addRoomMessageToUI(message, container = null, scroll = true) {
  const chatContainer =
    container || document.querySelector("#roomChatMessages");
  if (!chatContainer) return;

  const isSystem = message.user_id === "system";
  const isOwn = !isSystem && message.user_id === currentUser?.id;

  const msgDiv = document.createElement("div");
  msgDiv.className = `room-chat-message ${isSystem ? "system" : ""}`;
  msgDiv.innerHTML = isSystem
    ? `
      <div>📢 ${escapeHtml(message.message)}</div>
    `
    : `
      <span class="author">${escapeHtml(message.user_name || "Участник")}</span>
      <span class="time">${formatMessageTime(message.created_at)}</span>
      <div>${escapeHtml(message.message)}</div>
    `;

  chatContainer.appendChild(msgDiv);
  if (scroll) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Добавить донат в UI
function addDonationToUI(donation, container = null, scroll = true) {
  const chatContainer =
    container || document.querySelector("#roomChatMessages");
  if (!chatContainer) return;

  const div = document.createElement("div");
  div.className = "room-chat-message donation";
  div.innerHTML = `
      🔥 <strong>${escapeHtml(donation.from_user_name || "Кто-то")}</strong> поддержал автора на <strong>${donation.amount} ₽</strong>
      ${donation.message ? `<div style="margin-top: 4px; font-size: 12px;">💬 "${escapeHtml(donation.message)}"</div>` : ""}
    `;
  chatContainer.appendChild(div);
  if (scroll) chatContainer.scrollTop = chatContainer.scrollHeight;

  // Обновляем общую сумму донатов
  updateDonationsTotal();
}

// Добавить системное сообщение
function addSystemMessageToUI(message) {
  addRoomMessageToUI({
    user_id: "system",
    message: message,
    created_at: Date.now(),
  });
}

// Обновить счётчик слушателей
async function updateRoomListenersCount() {
  if (!currentRoom) return;
  try {
    const response = await fetch(`${API_BASE}/live-rooms/${currentRoom.id}`);
    if (response.ok) {
      const room = await response.json();
      const listenersSpan = document.querySelector("#listenersCount");
      if (listenersSpan) listenersSpan.textContent = room.listeners_count || 0;
    }
  } catch (e) {}
}

// Обновить общую сумму донатов
async function updateDonationsTotal() {
  if (!currentRoom) return;
  try {
    const response = await fetch(
      `${API_BASE}/room-donations/${currentRoom.id}`,
    );
    if (response.ok) {
      const donations = await response.json();
      const total = donations.reduce((sum, d) => sum + d.amount, 0);
      const totalSpan = document.querySelector("#donationsTotal");
      if (totalSpan) totalSpan.textContent = total;
    }
  } catch (e) {}
}

// Показать модальное окно доната
function showDonateModal(roomId, hostId) {
  const modalHtml = `
      <div class="modal" id="donateModal" style="display: flex;">
        <div class="modal-card">
          <h3>💰 Поддержать эфир</h3>
          <div class="form-group">
            <label>Сумма</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="donate-amount-btn" data-amount="50">50 ₽</button>
              <button class="donate-amount-btn" data-amount="100">100 ₽</button>
              <button class="donate-amount-btn" data-amount="500">500 ₽</button>
              <input type="number" id="customAmount" placeholder="Своя сумма" style="width: 120px;">
            </div>
          </div>
          <div class="form-group">
            <label>Сообщение (необязательно)</label>
            <textarea id="donateMessage" rows="2" placeholder="Скажите что-то приятное..."></textarea>
          </div>
          <div class="modal-buttons">
            <button class="btn-secondary" id="cancelDonateBtn">Отмена</button>
            <button class="btn-primary" id="sendDonateBtn">Отправить</button>
          </div>
          <p style="font-size: 11px; color: var(--text-secondary); margin-top: 12px; text-align: center;">
            ℹ️ Тестовый режим: деньги не списываются
          </p>
        </div>
      </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("donateModal");

  let selectedAmount = 100;
  document.querySelectorAll(".donate-amount-btn").forEach((btn) => {
    btn.onclick = () => {
      selectedAmount = parseInt(btn.getAttribute("data-amount"));
      document
        .querySelectorAll(".donate-amount-btn")
        .forEach((b) => (b.style.background = ""));
      btn.style.background = "var(--accent)";
      btn.style.color = "white";
    };
  });

  document.getElementById("cancelDonateBtn").onclick = () => modal.remove();
  document.getElementById("sendDonateBtn").onclick = async () => {
    const customAmount = document.getElementById("customAmount").value;
    if (customAmount) selectedAmount = parseInt(customAmount);

    if (isNaN(selectedAmount) || selectedAmount < 10) {
      alert("Минимальная сумма 10 ₽");
      return;
    }

    const message = document.getElementById("donateMessage").value.trim();

    try {
      const response = await fetch(`${API_BASE}/room-donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          from_user_id: currentUser.id,
          to_user_id: hostId,
          amount: selectedAmount,
          message: message,
        }),
      });
      if (response.ok) {
        if (currentSocket) {
          currentSocket.emit("donation", {
            roomId,
            amount: selectedAmount,
            message,
            from_user_name: currentUser.name,
          });
        }
        addDonationToUI({
          from_user_name: currentUser.name,
          amount: selectedAmount,
          message,
        });
        modal.remove();
      } else {
        alert("Ошибка отправки");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка соединения");
    }
  };
}

// ========== АУДИО-ФУНКЦИИ ДЛЯ КОМНАТ ==========

let localStream = null;
let peerInstances = new Map(); // peerId -> peer instance
let isBroadcasting = false;

// Проверка поддержки браузером
function isAudioSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Тест микрофона
async function testMicrophone() {
  if (!isAudioSupported()) {
    alert("Ваш браузер не поддерживает WebRTC");
    return false;
  }

  const indicator = document.getElementById("micTestIndicator");
  if (indicator) indicator.style.display = "flex";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const volumeLevel = document.getElementById("volumeLevel");

    function updateVolume() {
      analyser.getByteTimeDomainData(dataArray);
      let max = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = Math.abs(dataArray[i] - 128) / 128;
        if (v > max) max = v;
      }
      if (volumeLevel) volumeLevel.style.width = max * 100 + "%";
      if (!isBroadcasting) requestAnimationFrame(updateVolume);
    }
    updateVolume();

    // Проигрываем для проверки
    const audio = new Audio();
    audio.srcObject = stream;
    await audio.play();

    setTimeout(() => {
      audio.pause();
      if (!isBroadcasting) {
        stream.getTracks().forEach((track) => track.stop());
        if (indicator) indicator.style.display = "none";
        if (volumeLevel) volumeLevel.style.width = "0%";
      }
    }, 3000);

    return true;
  } catch (e) {
    console.error("Ошибка теста микрофона:", e);
    alert("Не удалось получить доступ к микрофону. Проверьте разрешения.");
    if (indicator) indicator.style.display = "none";
    return false;
  }
}

// Начать трансляцию (хост)
async function startBroadcast(roomId) {
  console.log("🎤 Начать эфир / Возобновить");

  if (!isAudioSupported()) {
    alert("Ваш браузер не поддерживает WebRTC");
    return;
  }

  try {
    // Если уже есть поток, но он остановлен (пауза) — создаём новый
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("🎙️ Микрофон получен");

    // Если комната ещё не в статусе LIVE, переводим её
    if (currentRoom && currentRoom.status !== "live") {
      await fetch(`${API_BASE}/live-rooms/${roomId}/start`, { method: "PUT" });
      currentRoom.status = "live";
    }

    if (currentSocket) {
      currentSocket.emit("start-broadcast", roomId);
    }

    isBroadcasting = true;

    // Обновляем UI — ищем кнопки заново при каждом вызове
    const startBtn = document.getElementById("startBroadcastBtn");
    const pauseBtn = document.getElementById("pauseBroadcastBtn");

    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;

    const statusDiv = document.querySelector(".room-player-status");
    if (statusDiv) {
      statusDiv.innerHTML = '<span class="pulse-dot"></span> 🔴 Эфир идёт';
      statusDiv.style.color = "#c2410c";
    }

    const audioStatus = document.getElementById("audioStatus");
    if (audioStatus) {
      audioStatus.innerHTML =
        '<i class="fa-solid fa-headphones"></i> 🎵 Трансляция идёт';
      audioStatus.style.color = "#2f6b47";
    }

    console.log("🎙️ Трансляция активна");
  } catch (e) {
    console.error("Ошибка начала трансляции:", e);
    alert("Не удалось получить доступ к микрофону");
  }
}

function pauseBroadcast() {
  console.log("⏸ Пауза нажата");

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
      console.log("🔇 Дорожка остановлена:", track.kind);
    });
    localStream = null;
  }

  if (currentSocket && currentRoom) {
    currentSocket.emit("pause-broadcast", currentRoom.id);
  }

  isBroadcasting = false;

  // Обновляем UI
  const startBtn = document.getElementById("startBroadcastBtn");
  const pauseBtn = document.getElementById("pauseBroadcastBtn");

  if (startBtn) startBtn.disabled = false;
  if (pauseBtn) pauseBtn.disabled = true;

  const statusDiv = document.querySelector(".room-player-status");
  if (statusDiv) {
    statusDiv.innerHTML = '<span class="pulse-dot"></span> ⏸ Эфир на паузе';
    statusDiv.style.color = "#b85c3a";
  }

  const audioStatus = document.getElementById("audioStatus");
  if (audioStatus) {
    audioStatus.innerHTML =
      '<i class="fa-regular fa-circle-pause"></i> Трансляция на паузе';
  }

  console.log("🔇 Трансляция на паузе");
}

async function endBroadcast() {
  console.log("🔴 Завершение эфира");

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (currentSocket && currentRoom) {
    currentSocket.emit("stop-broadcast", currentRoom.id);
  }

  isBroadcasting = false;

  if (currentRoom) {
    await fetch(`${API_BASE}/live-rooms/${currentRoom.id}/end`, {
      method: "PUT",
    });
  }

  // Показываем кнопку создания поста
  const fab = document.getElementById("fabBtn");
  if (fab) fab.style.display = "flex";

  setActiveScreen("feed");
  renderFeed();
}

// Создать peer-соединение для слушателя (вызывается у хоста)
function createPeerForListener(listenerId, listenerName) {
  if (!localStream || !isBroadcasting) return;

  console.log(`🔗 Создаём peer для слушателя ${listenerName} (${listenerId})`);

  const peer = new SimplePeer({
    initiator: true,
    stream: localStream,
    trickle: false,
  });

  peer.on("signal", (signalData) => {
    if (currentSocket && currentRoom) {
      currentSocket.emit("webrtc-offer", {
        roomId: currentRoom.id,
        signal: signalData,
        targetId: listenerId,
      });
    }
  });

  peer.on("error", (err) => {
    console.error(`Peer ошибка (${listenerId}):`, err);
  });

  peer.on("close", () => {
    console.log(`Peer закрыт (${listenerId})`);
    peerInstances.delete(listenerId);
  });

  peerInstances.set(listenerId, peer);
}

// Присоединиться к трансляции (слушатель)
async function joinBroadcast(hostId) {
  console.log(
    `🎧 Слушатель ${currentUser.name} присоединяется к трансляции хоста ${hostId}`,
  );

  const peer = new SimplePeer({ trickle: false });

  peer.on("signal", (signalData) => {
    if (currentSocket && currentRoom) {
      currentSocket.emit("webrtc-answer", {
        roomId: currentRoom.id,
        signal: signalData,
        targetId: hostId,
      });
    }
  });

  peer.on("stream", (stream) => {
    console.log("🎧 Получен аудиопоток от хоста");
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 0.8;

    // Обновляем UI
    const audioStatus = document.getElementById("audioStatus");
    if (audioStatus) {
      audioStatus.innerHTML =
        '<i class="fa-solid fa-headphones"></i> 🎵 Слушаем трансляцию';
      audioStatus.style.color = "#2f6b47";
    }
  });

  peer.on("error", (err) => {
    console.error("Ошибка peer:", err);
    const audioStatus = document.getElementById("audioStatus");
    if (audioStatus) {
      audioStatus.innerHTML =
        '<i class="fa-regular fa-circle-exclamation"></i> Ошибка подключения';
    }
  });

  peer.on("close", () => {
    console.log("Peer соединение закрыто");
    const audioStatus = document.getElementById("audioStatus");
    if (audioStatus) {
      audioStatus.innerHTML =
        '<i class="fa-regular fa-headphones"></i> Трансляция остановлена';
      audioStatus.style.color = "var(--text-secondary)";
    }
  });

  peerInstances.set("listener", peer);
}

// Остановить прослушивание (слушатель)
function leaveBroadcast() {
  const peer = peerInstances.get("listener");
  if (peer) {
    peer.destroy();
    peerInstances.delete("listener");
  }
}
