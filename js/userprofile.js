// ========== ПРОСМОТР ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ==========
function viewUserProfile(userId) {
  viewingUserId = userId;
  renderUserProfileScreen();
  setActiveScreen("profile");
}

function renderUserProfileScreen() {
  const user = users.find((u) => u.id === viewingUserId);
  if (!user) return;

  const container = document.getElementById("profileScreen");
  if (!container) return;

  const rating = user.rating || 0;
  const genres = user.genres || "";
  const genreList = genres ? genres.split(",").map((g) => g.trim()) : [];
  const daysInCommunity = Math.floor(
    (Date.now() - user.created_at) / (1000 * 60 * 60 * 24),
  );
  const followersCount = user.followers_count || 0;
  const followingCount = user.following_count || 0;
  const isFollow = isFollowing(user.id);

  container.innerHTML = `
      <!-- ШАПКА С КНОПКАМИ -->
      <div class="profile-actions-bar">
        <button id="backFromProfileBtn" class="back-to-profile-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Назад
        </button>
        
        <button class="subscribe-action-btn ${isFollow ? "subscribed" : ""}" id="subscribeActionBtn">
          <i class="fa-${isFollow ? "solid" : "regular"} fa-bell${isFollow ? "-slash" : ""}"></i> 
          <span>${isFollow ? "Отписаться" : "Подписаться"}</span>
        </button>
      </div>
      
      <!-- КАРТОЧКА ПРОФИЛЯ -->
      <div class="profile-header-card">
        <div class="profile-avatar">${user.name.charAt(0)}</div>
        <div class="profile-name">${escapeHtml(user.name)}</div>
        <div class="profile-bio">${escapeHtml(user.instruments || "Инструменты не указаны")} ${user.instruments && user.city ? "·" : ""} ${escapeHtml(user.city || "Город не указан")}</div>
        
        ${genreList.length > 0 ? `<div class="profile-genres">${genreList.map((g) => `<span class="genre-badge">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        
        ${user.about ? `<div class="profile-about">${escapeHtml(user.about)}</div>` : ""}
        
        <div class="profile-rating">
          <i class="fa-solid fa-star rating-star"></i> ${rating} очков репутации
        </div>
        
        <div class="profile-joined">
          в сообществе ${daysInCommunity} ${getDeclension(daysInCommunity, "день", "дня", "дней")}
        </div>

        
                <div class="profile-stats">
                  <div class="stat">
                    <strong>${followersCount}</strong>
                    <span>подписчиков</span>
                  </div>
                  <div class="stat">
                    <strong>${followingCount}</strong>
                    <span>подписок</span>
                  </div>
                </div>        
        
        
        <button class="profile-edit-btn" id="messageToUserBtn">
          <i class="fa-regular fa-message"></i> Написать сообщение
        </button>
      </div>
    `;

  // Обработчик кнопки "Назад"
  document.getElementById("backFromProfileBtn").onclick = () => {
    viewingUserId = null;
    setActiveScreen("feed");
    renderFeed();
  };

  // Обработчик кнопки "Подписаться/Отписаться"
  document
    .getElementById("subscribeActionBtn")
    ?.addEventListener("click", async () => {
      if (isFollowing(user.id)) {
        await unfollowUser(user.id);
        // Обновляем страницу профиля
        renderUserProfileScreen();
      } else {
        await followUser(user.id);
        renderUserProfileScreen();
      }
    });

  // Обработчик кнопки "Написать сообщение"
  document.getElementById("messageToUserBtn").onclick = () => {
    showChatModal(user.id, user.name);
  };
}

function renderUserProfileTabContent(tab, user) {
  const content = document.getElementById("profileTabContent");
  if (!content) return;

  if (tab === "info") {
    content.innerHTML = `
        <div class="profile-info-card">
          <div class="info-row"><span class="info-label">Инструменты:</span><span>${escapeHtml(user.instruments || "не указано")}</span></div>
          <div class="info-row"><span class="info-label">Город:</span><span>${escapeHtml(user.city || "не указан")}</span></div>
          <div class="info-row"><span class="info-label">Жанры:</span><span>${escapeHtml(user.genres || "не указаны")}</span></div>
          <div class="info-row"><span class="info-label">В сообществе:</span><span>${Math.floor((Date.now() - user.created_at) / (1000 * 60 * 60 * 24 * 30))} месяцев</span></div>
          <div class="info-row"><span class="info-label">Рейтинг:</span><span><i class="fa-solid fa-star rating-star"></i> ${user.rating || 0}</span></div>
        </div>
      `;
  } else if (tab === "posts") {
    const userPosts = getUserPosts(user.id, true);
    if (userPosts.length === 0) {
      content.innerHTML =
        '<div class="empty-state"><i class="fa-regular fa-newspaper"></i><p>У пользователя пока нет объявлений</p></div>';
      return;
    }

    content.innerHTML = userPosts
      .map(
        (post) => `
        <div class="my-post-card ${post.status === "deleted" ? "deleted" : ""}">
          <div class="my-post-header">
            ${getBadgeHTML(post.type)}
            ${post.status === "deleted" ? '<span class="deleted-badge">Скрыто</span>' : ""}
          </div>
          <div class="my-post-title">${escapeHtml(post.title)}</div>
          <div class="my-post-meta">${formatDate(post.created_at)}</div>
          <div class="my-post-desc">${escapeHtml(post.description)}</div>
        </div>
      `,
      )
      .join("");
  }
}
