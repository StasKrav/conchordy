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
  // Если roomId начинается с 'call_', пробуем получить данные из БД
  if (roomId.startsWith('call_')) {
    try {
      const response = await fetch(`${API_BASE}/video-calls/${roomId}`);
      if (response.ok) {
        const call = await response.json();
        // Определяем роли
        const isCreator = call.creator_id === currentUser.id;
        const otherUser = isCreator ? call.participant_name : call.creator_name;
        // Передаём правильные имена
        if (isCreator) {
          teacherName = otherUser;
          studentName = null;
        } else {
          teacherName = call.creator_name;
          studentName = null;
        }
        isTeacher = isCreator;
      }
    } catch (e) {
      console.error('Ошибка загрузки звонка:', e);
    }
  }
  
  // Скрываем кнопку создания поста
  const fab = document.getElementById('fabBtn');
    if (fab) fab.style.display = 'none';
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
        <div class="video-room-title">${isTeacher ? 'Ваш урок' : 'Урок с ' + escapeHtml(teacherName)}</div>
        <div class="video-room-timer" id="videoTimer">00:00</div>
      </div>
      
      <div class="video-panel">
        <div class="video-wrapper" id="remoteVideoWrapper">
          <video id="remoteVideo" autoplay playsinline></video>
          <div class="video-label">${isTeacher ? escapeHtml(studentName || 'Ученик') : escapeHtml(teacherName)}</div>
          <button class="video-fullscreen-btn" id="remoteFullscreenBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <div class="video-wrapper" id="localVideoWrapper">
          <video id="localVideo" autoplay playsinline muted></video>
          <div class="video-label">${isTeacher ? 'Вы (учитель)' : 'Вы'}</div>
          <button class="video-fullscreen-btn" id="localFullscreenBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="video-controls">
        <button class="video-control-btn" id="toggleMicBtn" title="Микрофон">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <path d="M12 19v3"/>
          </svg>
        </button>
        <button class="video-control-btn" id="toggleVideoBtn" title="Камера">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <button class="video-control-btn" id="shareScreenBtn" title="Экран">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </button>
        <button class="video-control-btn danger" id="endLessonBtn" title="Завершить">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  setActiveScreen('room');
  
  // Инициализация WebRTC с видео
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
  document.getElementById('remoteFullscreenBtn').onclick = () => {
    const wrapper = document.getElementById('remoteVideoWrapper');
    if (wrapper.requestFullscreen) wrapper.requestFullscreen();
  };
  document.getElementById('localFullscreenBtn').onclick = () => {
    const wrapper = document.getElementById('localVideoWrapper');
    if (wrapper.requestFullscreen) wrapper.requestFullscreen();
  };
  
  document.getElementById('backFromVideoBtn').onclick = () => {
    if (confirm('Завершить урок?')) {
      endVideoLesson();
    }
  };
}

async function initVideoCall(roomId, isTeacher) {
  try {
    videoLocalStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: { width: { ideal: 640 }, height: { ideal: 480 } }
    });
    
    const localVideo = document.getElementById('localVideo');
    if (localVideo) localVideo.srcObject = videoLocalStream;
    
    videoPeer = new SimplePeer({
      initiator: isTeacher,
      stream: videoLocalStream,
      trickle: false
    });
    
    videoPeer.on('signal', (signalData) => {
      if (currentSocket) {
        currentSocket.emit('webrtc-offer', { roomId, signal: signalData });
      }
    });
    
    videoPeer.on('stream', (stream) => {
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) remoteVideo.srcObject = stream;
    });
    
    videoPeer.on('error', (err) => console.error('Peer error:', err));
    
    currentSocket.on('webrtc-answer', (data) => {
      if (videoPeer) videoPeer.signal(data.signal);
    });
    
    currentSocket.on('webrtc-offer', (data) => {
      if (videoPeer && !isTeacher) videoPeer.signal(data.signal);
    });
    
  } catch (e) {
    console.error('Ошибка доступа к камере:', e);
    alert('Не удалось получить доступ к камере и микрофону');
  }
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
  if (videoLocalStream) videoLocalStream.getTracks().forEach(t => t.stop());
  if (videoPeer) videoPeer.destroy();
  
  // Показываем кнопку создания поста
  const fab = document.getElementById('fabBtn');
  if (fab) fab.style.display = 'flex';
  
  setActiveScreen('feed');
  renderFeed();
}

function showCreateVideoRoomModal() {
  const modalHtml = `
    <div class="modal" id="createVideoRoomModal" style="display: flex;">
      <div class="modal-card">
        <h3>Создать видео-комнату</h3>
        <div class="form-group">
          <label>Название</label>
          <input type="text" id="videoRoomTitle" placeholder="например: Урок гитары">
        </div>
        <div class="form-group">
          <label>Тип комнаты</label>
          <select id="videoRoomType">
            <option value="lesson">Урок (учитель → ученик)</option>
            <option value="meeting">Совещание (до 5 участников)</option>
          </select>
        </div>
        <div class="modal-buttons">
          <button class="btn-secondary" id="cancelVideoRoomBtn">Отмена</button>
          <button class="btn-primary" id="createVideoRoomBtn">Создать</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('createVideoRoomModal');
  
  document.getElementById('cancelVideoRoomBtn').onclick = () => modal.remove();
  document.getElementById('createVideoRoomBtn').onclick = async () => {
    const title = document.getElementById('videoRoomTitle').value.trim();
    if (!title) {
      alert('Введите название');
      return;
    }
    const roomType = document.getElementById('videoRoomType').value;
    
    // Создаём комнату в БД
    const response = await fetch(`${API_BASE}/live-rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host_id: currentUser.id,
        title: title,
        description: `Видео-комната. Тип: ${roomType}`,
        room_type: 'video'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      modal.remove();
      // Открываем видео-комнату
      startVideoLesson(result.roomId, true, null, null);
    } else {
      alert('Ошибка создания комнаты');
    }
  };
}
