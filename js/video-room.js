// ========== ВИДЕО-УРОКИ ==========

let videoRoom = null;
let videoLocalStream = null;
let videoPeer = null;
let videoTimerInterval = null;
let lessonStartTime = null;

function showVideoLessonModal(teacherId, teacherName, price) {
  const modalHtml = `
    <div class="modal" id="videoLessonModal" style="display: flex;">
      <div class="modal-card">
        <h3>Видео-урок с ${escapeHtml(teacherName)}</h3>
        <div class="form-group">
          <label>Длительность</label>
          <select id="lessonDuration">
            <option value="30">30 минут — ${Math.round(price * 0.5)} ₽</option>
            <option value="60" selected>60 минут — ${price} ₽</option>
            <option value="90">90 минут — ${Math.round(price * 1.5)} ₽</option>
          </select>
        </div>
        <div class="form-group">
          <label>Дата и время</label>
          <input type="datetime-local" id="lessonDateTime">
        </div>
        <div class="modal-buttons">
          <button class="btn-secondary" id="cancelLessonBtn">Отмена</button>
          <button class="btn-primary" id="confirmLessonBtn">Записаться</button>
        </div>
        <p class="test-mode-note">Тестовый режим: оплата не списывается</p>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('videoLessonModal');
  
  // Устанавливаем минимальную дату (сегодня + 1 час)
  const datetimeInput = document.getElementById('lessonDateTime');
  const minDateTime = new Date();
  minDateTime.setHours(minDateTime.getHours() + 1);
  datetimeInput.min = minDateTime.toISOString().slice(0, 16);
  datetimeInput.value = minDateTime.toISOString().slice(0, 16);
  
  document.getElementById('cancelLessonBtn').onclick = () => modal.remove();
  document.getElementById('confirmLessonBtn').onclick = async () => {
    const duration = parseInt(document.getElementById('lessonDuration').value);
    const scheduledAt = new Date(document.getElementById('lessonDateTime').value).getTime();
    
    if (scheduledAt < Date.now()) {
      alert('Выберите будущее время');
      return;
    }
    
    // Создаём урок (заглушка)
    alert(`[ТЕСТ] Урок запланирован\nУчитель: ${teacherName}\nДлительность: ${duration} мин\nНачало: ${new Date(scheduledAt).toLocaleString()}`);
    modal.remove();
  };
}

// Начать видео-урок
async function startVideoLesson(roomId, isTeacher, teacherName, studentName) {
  // ========== ПОДКЛЮЧАЕМ WEBSOCKET ==========
  if (!currentSocket) {
    console.log('🔌 Подключаем WebSocket для видео-комнаты...');
    currentSocket = io();
    
    // ✅ Ждём подключения
    await new Promise((resolve) => {
      currentSocket.on('connect', () => {
        console.log('🔗 WebSocket подключён');
        currentSocket.emit('join-room', roomId, currentUser.id, currentUser.name);
        console.log(`📡 Присоединился к комнате ${roomId}`);
        resolve();
      });
    });
  } else {
    console.log(`📡 Присоединяемся к комнате ${roomId}`);
    currentSocket.emit('join-room', roomId, currentUser.id, currentUser.name);
  }

  // Скрываем кнопку создания поста
  const fab = document.getElementById("fabBtn");
  if (fab) fab.style.display = "none";
  
  const container = document.getElementById('roomScreen');
  if (!container) return;
  
  container.innerHTML = `
    <div class="video-room-container">
      <div class="video-room-header">
        <button id="backFromVideoBtn" class="back-to-profile-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Назад
        </button>
        <div class="video-room-title">${isTeacher ? 'Видео-звонок (вы создатель)' : 'Видео-звонок'}</div>
        <div class="video-room-timer" id="videoTimer">00:00</div>
      </div>
      
      <div class="video-panel">
        <!-- Удалённое видео (собеседник) — большой -->
        <div class="video-wrapper-remote" id="remoteVideoWrapper">
          <video id="remoteVideo" autoplay playsinline></video>
          <div class="video-label" id="remoteLabel">Собеседник</div>
          <button class="video-fullscreen-btn" id="remoteFullscreenBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        
        <!-- Локальное видео (вы) — маленькое в углу -->
        <div class="video-wrapper-local" id="localVideoWrapper">
          <video id="localVideo" autoplay playsinline muted></video>
          <div class="video-label">Вы</div>
        </div>
      </div>
      
      <div class="video-controls">
        <button class="video-control-btn" id="toggleMicBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <path d="M12 19v3"/>
          </svg>
        </button>
        <button class="video-control-btn" id="toggleVideoBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <button class="video-control-btn" id="shareScreenBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </button>
        <button class="video-control-btn danger" id="endLessonBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  setActiveScreen('room');

  
  // ===== ПЕРЕТАСКИВАНИЕ ЛОКАЛЬНОГО ВИДЕО =====
  const localWrapper = document.getElementById('localVideoWrapper');
  let isDragging = false;
  let startX, startY, origX, origY;
  
  if (localWrapper) {
    // Начало перетаскивания
    localWrapper.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = localWrapper.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      localWrapper.style.cursor = 'grabbing';
      e.preventDefault();
    });
  
    // Перемещение
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      localWrapper.style.left = (origX + dx) + 'px';
      localWrapper.style.top = (origY + dy) + 'px';
      localWrapper.style.right = 'auto';
      localWrapper.style.bottom = 'auto';
    });
  
    // Завершение перетаскивания
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        localWrapper.style.cursor = 'default';
      }
    });
  }
  
  // Запускаем WebRTC
  await initVideoCall(roomId, isTeacher);
  
  // Таймер урока
  lessonStartTime = Date.now();
  videoTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lessonStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timerEl = document.getElementById('videoTimer');
    if (timerEl) timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
  
  // Обработчики кнопок
  document.getElementById('toggleMicBtn').onclick = toggleMicrophone;
  document.getElementById('toggleVideoBtn').onclick = toggleVideo;
  document.getElementById('shareScreenBtn').onclick = shareScreen;
  document.getElementById('endLessonBtn').onclick = endVideoLesson;
  
  // Полноэкранный режим
  const remoteFullscreenBtn = document.getElementById('remoteFullscreenBtn');
  if (remoteFullscreenBtn) {
    remoteFullscreenBtn.onclick = () => {
      const wrapper = document.getElementById('remoteVideoWrapper');
      if (wrapper && wrapper.requestFullscreen) wrapper.requestFullscreen();
    };
  }
  
  const localFullscreenBtn = document.getElementById('localFullscreenBtn');
  if (localFullscreenBtn) {
    localFullscreenBtn.onclick = () => {
      const wrapper = document.getElementById('localVideoWrapper');
      if (wrapper && wrapper.requestFullscreen) wrapper.requestFullscreen();
    };
  }
  
  const backBtn = document.getElementById('backFromVideoBtn');
  if (backBtn) {
    backBtn.onclick = () => {
      if (confirm('Завершить звонок?')) {
        endVideoLesson();
      }
    };
  }
}

async function initVideoCall(roomId, isTeacher) {
  if (videoLocalStream) {
    videoLocalStream.getTracks().forEach(track => track.stop());
    videoLocalStream = null;
  }

  // ⭐ ПОЛУЧАЕМ КАМЕРУ ДО СОЗДАНИЯ ПИРА
  try {
    videoLocalStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    
    const localVideo = document.getElementById('localVideo');
    if (localVideo) localVideo.srcObject = videoLocalStream;
    
    console.log('🎥 Камера получена');
    
  } catch (e) {
    console.warn('⚠️ Камера не доступна:', e.name);
    try {
      videoLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.style.display = 'none';
        const wrapper = document.getElementById('localVideoWrapper');
        if (wrapper) {
          const label = wrapper.querySelector('.video-label');
          if (label) label.textContent = 'Вы (аудио)';
        }
      }
      console.log('🎙️ Микрофон получен');
    } catch (audioError) {
      console.warn('⚠️ Микрофон тоже не доступен');
    }
  }

  // ⭐ УЧЕНИК ВСЕГДА ИНИЦИАТОР, УЧИТЕЛЬ ОТВЕЧАЮЩИЙ
  // Ученик создаёт offer → учитель получает offer → учитель отвечает answer
  const amInitiator = !isTeacher;  // ученик инициирует соединение

  videoPeer = new SimplePeer({
    initiator: amInitiator,
    trickle: false,
    stream: videoLocalStream
  });

  videoPeer.on('signal', (signalData) => {
    console.log('📡 Сигнал:', signalData.type, isTeacher ? '(учитель)' : '(ученик)');
    if (currentSocket) {
      const eventType = signalData.type === 'offer' ? 'webrtc-offer' : 'webrtc-answer';
      console.log(`📤 Отправляем ${signalData.type} на сервер`);
      currentSocket.emit(eventType, {
        roomId: roomId,
        signal: signalData,
        targetId: null
      });
    } else {
      console.error('❌ currentSocket = null!');
    }
  });

  videoPeer.on('stream', (stream) => {
    console.log('📹 Поток получен!');
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
      remoteVideo.play();
      const label = document.getElementById('remoteLabel');
      if (label) label.textContent = 'Собеседник';
    }
  });

  videoPeer.on('error', (err) => {
    console.error('Peer error:', err);
  });

  videoPeer.on('connect', () => {
    console.log('✅ WebRTC соединение установлено!');
  });

  if (currentSocket) {
    currentSocket.off('webrtc-offer');
    currentSocket.off('webrtc-answer');
    
    currentSocket.on('webrtc-offer', (data) => {
      console.log('📡 Получен offer', isTeacher ? '(учитель)' : '(ученик)');
      if (videoPeer) {
        videoPeer.signal(data.signal);
      }
    });
    
    currentSocket.on('webrtc-answer', (data) => {
      console.log('📡 Получен answer', isTeacher ? '(учитель)' : '(ученик)');
      if (videoPeer) {
        videoPeer.signal(data.signal);
      }
    });
  }
  
  console.log('🎥 Видео-звонок инициализирован', isTeacher ? '(учитель)' : '(ученик)');
}

function toggleMicrophone() {
  if (videoLocalStream) {
    const audioTrack = videoLocalStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const btn = document.getElementById('toggleMicBtn');
      if (btn) btn.classList.toggle('active', !audioTrack.enabled);
    }
  }
}

function toggleVideo() {
  if (videoLocalStream) {
    const videoTrack = videoLocalStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const btn = document.getElementById('toggleVideoBtn');
      if (btn) btn.classList.toggle('active', !videoTrack.enabled);
    }
  }
}

async function shareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = videoPeer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
    videoTrack.onended = () => {
      if (videoLocalStream) {
        const originalTrack = videoLocalStream.getVideoTracks()[0];
        if (sender && originalTrack) sender.replaceTrack(originalTrack);
      }
    };
  } catch (e) {
    console.error('Ошибка шаринга экрана:', e);
  }
}

function endVideoLesson() {
  if (videoTimerInterval) clearInterval(videoTimerInterval);
  
  // Освобождаем все треки
  if (videoLocalStream) {
    videoLocalStream.getTracks().forEach(track => {
      track.stop();
      console.log('🔇 Трек остановлен:', track.kind);
    });
    videoLocalStream = null;
  }
  
  if (videoPeer) {
    videoPeer.destroy();
    videoPeer = null;
  }
  
  // Показываем кнопку создания поста
  const fab = document.getElementById('fabBtn');
  if (fab) fab.style.display = 'flex';
  
  setActiveScreen('feed');
  renderFeed();
}

function showCreateVideoRoomModal() {
  // Получаем список пользователей для выбора
  const userOptions = users
    .filter(u => u.id !== currentUser?.id)
    .map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`)
    .join('');
  
  const modalHtml = `
    <div class="modal" id="createVideoRoomModal" style="display: flex;">
      <div class="modal-card">
        <h3>Видео-звонок</h3>
        <div class="form-group">
          <label>Название</label>
          <input type="text" id="videoRoomTitle" placeholder="например: Урок гитары">
        </div>
        <div class="form-group">
          <label>Пригласить пользователя</label>
          <select id="videoRoomParticipant">
            <option value="">Выберите пользователя</option>
            ${userOptions}
          </select>
        </div>
        <div class="modal-buttons">
          <button class="btn-secondary" id="cancelVideoRoomBtn">Отмена</button>
          <button class="btn-primary" id="createVideoRoomBtn">Создать звонок</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('createVideoRoomModal');
  
  document.getElementById('cancelVideoRoomBtn').onclick = () => modal.remove();
  document.getElementById('createVideoRoomBtn').onclick = async () => {
    const title = document.getElementById('videoRoomTitle').value.trim();
    const participantId = document.getElementById('videoRoomParticipant').value;
    
    if (!title) {
      alert('Введите название');
      return;
    }
    if (!participantId) {
      alert('Выберите участника');
      return;
    }
    
    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    
    try {
      // 1. Создаём запись в video_calls
      const response = await fetch(`${API_BASE}/video-calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: callId,
          creator_id: currentUser.id,
          participant_id: participantId
        })
      });
      
      if (response.ok) {
        modal.remove();
        
        // 2. Отправляем ссылку в чат участнику
        const link = `${window.location.origin}/index.html?room=${callId}`;
        await sendChatMessage(participantId, `📹 Приглашение на видео-звонок: ${link}`);
        
        // 3. Открываем видео-комнату для создателя
        startVideoLesson(callId, true, null, null);
      } else {
        alert('Ошибка создания звонка');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка соединения');
    }
  };
}
