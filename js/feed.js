let currentFilter = null;

async function renderFeed() {
  const container = document.getElementById("feedList");
  if (!container) return;

  // Загружаем активные комнаты
  let liveRooms = [];
  try {
    const response = await fetch(`${API_BASE}/live-rooms`);
    if (response.ok) {
      liveRooms = await response.json();
      console.log("🎙️ Загружено комнат:", liveRooms.length);
    }
  } catch (e) {
    console.error("Ошибка загрузки комнат:", e);
  }

  let filtered = posts.filter((p) => p.status === "active");

  // Фильтр по подпискам
  if (currentFeedMode === "subscriptions" && followingIds.length > 0) {
    filtered = filtered.filter((p) => followingIds.includes(p.user_id));
  }

  // Существующие фильтры
  if (currentFilter) {
    filtered = filtered.filter((p) => p.type === currentFilter);
  }
  if (currentGenreFilter) {
    filtered = filtered.filter((p) => {
      const author = users.find((u) => u.id === p.user_id);
      return (
        author &&
        author.genres &&
        author.genres.toLowerCase().includes(currentGenreFilter.toLowerCase())
      );
    });
  }

  // Сообщение, если в режиме подписок ничего нет
  if (
    currentFeedMode === "subscriptions" &&
    filtered.length === 0 &&
    followingIds.length === 0
  ) {
    container.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-secondary);">🔔 Вы ни на кого не подписаны<br><small>Подпишитесь на музыкантов, чтобы видеть их посты здесь</small></div>';
    return;
  }

  if (
    currentFeedMode === "subscriptions" &&
    filtered.length === 0 &&
    followingIds.length > 0
  ) {
    container.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-secondary);">🔔 Новых постов от подписанных музыкантов пока нет</div>';
    return;
  }

  if (filtered.length === 0 && liveRooms.length === 0) {
    container.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-secondary);">Нет публикаций · создайте первую</div>';
    return;
  }

  // Формируем HTML: сначала комнаты, потом посты
  let html = "";

  // Блок с активными комнатами
  if (liveRooms.length > 0) {
    html += `
        <div class="live-rooms-section">
          <div class="live-rooms-header">
            <span class="live-dot"></span>
            <h3>Сейчас в эфире</h3>
          </div>
          <div class="rooms-list">
            ${liveRooms
              .map(
                (room) => `
              <div class="room-card" data-room-id="${room.id}">
                <div class="room-card-header">
                  <div class="room-card-title">
                    <span class="live-badge">LIVE</span>
                    ${escapeHtml(room.title)}
                  </div>
                  <span class="room-card-listeners">
                  <svg width="30" height="20" viewBox="0 0 544 384" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="176" cy="144" r="64" stroke="currentColor" stroke-width="20" fill="none"/>
                  <path d="M80,304 C112,208 240,208 272,304" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
                  <path d="M80,304 L464,304" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
                  <path d="M272,304 C304,208 432,208 464,304" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
                  <circle cx="368" cy="144" r="64" stroke="currentColor" stroke-width="20" fill="none"/>
                  
                  </svg>
                  ${room.listeners_count || 0}</span>
                </div>
                <div class="room-card-host">${escapeHtml(room.host_name)}</div>
                ${room.description ? `<div class="room-card-desc">${escapeHtml(room.description)}</div>` : ''}
                <div class="room-card-stats">
                  <span>${room.speakers_count || 1} спикеров</span>
                  <span>нажмите, чтобы присоединиться</span>
                </div>

                ${
                  currentUser && room.host_id === currentUser.id
                    ? `
                  <button class="end-room-btn" data-room-id="${room.id}" style="margin-top: 8px; background: #c2410c; color: white; border: none; padding: 6px 12px; border-radius: 20px; font-size: 11px;">
                    Завершить эфир
                  </button>
                `
                    : ""
                }
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
  }

  // Посты
  if (filtered.length > 0) {
    html += filtered
      .map((post) => {
        const authorName = getAuthorName(post.user_id);
        const hasAudio = post.audio_url && post.audio_url !== "";

        return `
          <div class="post-card">
            <div class="post-header">
              ${getBadgeHTML(post.type)}
              <span class="verified-mark clickable-name" data-user-id="${post.user_id}">${escapeHtml(authorName)} · проверен</span>
            </div>
            <div class="post-title">${escapeHtml(post.title)}</div>
            <div class="post-meta">${formatDate(post.created_at)}</div>
            <div class="post-desc">${escapeHtml(post.description)}</div>
            ${
              hasAudio
                ? `
              <div class="timeline-placeholder" data-post-id="${post.id}" data-audio-url="${post.audio_url}"></div>
            `
                : ""
            }
            <hr />
            <div class="post-actions">
              <div class="chat-action" data-author-id="${post.user_id}" data-author-name="${escapeHtml(authorName)}">
                <i class="fa-regular fa-message"></i> Написать в чат
              </div>
              <div class="discuss-action" data-post-id="${post.id}" data-post-title="${escapeHtml(post.title)}">
                <i class="fa-regular fa-comments"></i> Обсудить
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  container.innerHTML = html;

  // Обработчики
  document.querySelectorAll(".chat-action").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const authorId = el.getAttribute("data-author-id");
      const authorName = el.getAttribute("data-author-name");
      showChatModal(authorId, authorName);
    });
  });

  document.querySelectorAll(".discuss-action").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const postId = el.getAttribute("data-post-id");
      const postTitle = el.getAttribute("data-post-title");
      showDiscussModal(postId, postTitle);
    });
  });

  document.querySelectorAll(".clickable-name").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const userId = el.getAttribute("data-user-id");
      if (userId) viewUserProfile(userId);
    });
  });

  document.querySelectorAll(".filter-badge").forEach((b) => {
    const type = b.getAttribute("data-type");
    if (currentFilter === type) b.classList.add("active");
    else b.classList.remove("active");
  });

  // Инициализация таймкод-комментариев
  document
    .querySelectorAll(".timeline-placeholder")
    .forEach(async (placeholder) => {
      const postId = placeholder.getAttribute("data-post-id");
      const audioUrl = placeholder.getAttribute("data-audio-url");

      if (placeholder.hasAttribute("data-initialized")) return;
      placeholder.setAttribute("data-initialized", "true");

      setTimeout(() => {
        try {
          const timeline = new TimelineComments(postId, audioUrl, placeholder);
        } catch (e) {
          console.error(
            "Ошибка инициализации комментариев для поста",
            postId,
            e,
          );
        }
      }, 100);
    });

  // Обработчики для комнат
  document.querySelectorAll(".room-card").forEach((card) => {
    card.addEventListener("click", () => {
      const roomId = card.getAttribute("data-room-id");
      openRoom(roomId, false);
    });
  });

  document.querySelectorAll(".end-room-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const roomId = btn.getAttribute("data-room-id");
      if (confirm("Завершить эфир?")) {
        await fetch(`${API_BASE}/live-rooms/${roomId}/end`, { method: "PUT" });
        renderFeed(); // обновляем ленту
      }
    });
  });
}
