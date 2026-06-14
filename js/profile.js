// ========== ПРОФИЛЬ (СВОЙ) ==========
let profileActiveTab = "posts";

function renderProfileScreen() {
  if (
    document.querySelector(".nav-item.active")?.getAttribute("data-screen") ===
    "profile"
  ) {
    viewingUserId = null;
  }
  const container = document.getElementById("profileScreen");
  if (!container || !currentUser) return;

  if (viewingUserId && viewingUserId !== currentUser.id) {
    renderUserProfileScreen();
    return;
  }

  const rating = currentUser.rating || 0;
  const genres = currentUser.genres || "";
  const genreList = genres ? genres.split(",").map((g) => g.trim()) : [];
  const daysInCommunity = Math.floor(
    (Date.now() - currentUser.created_at) / (1000 * 60 * 60 * 24),
  );

  container.innerHTML = `
      <div class="profile-header-card">
        <div class="profile-avatar">${currentUser.name.charAt(0)}</div>
        <div class="profile-name">${escapeHtml(currentUser.name)}</div>
        <div class="profile-bio">${escapeHtml(currentUser.instruments || "")} ${currentUser.instruments && currentUser.city ? "·" : ""} ${escapeHtml(currentUser.city || "")}</div>     
        
        
        ${genreList.length > 0 ? `<div class="profile-genres">${genreList.map((g) => `<span class="genre-badge">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        
        ${currentUser.about ? `<div class="profile-about">${escapeHtml(currentUser.about)}</div>` : ""}

        <div class="profile-rating">
                  <i class="fa-solid fa-star rating-star"></i> ${rating} очков репутации
                </div>
                
                <div class="profile-joined">
                  в сообществе ${daysInCommunity} ${getDeclension(daysInCommunity, "день", "дня", "дней")}
                </div>

        <div class="profile-stats">
                  <div class="stat">
                    <strong>${currentUser.followers_count || 0}</strong>
                    <span>подписчиков</span>
                  </div>
                  <div class="stat">
                    <strong>${currentUser.following_count || 0}</strong>
                    <span>подписок</span>
                  </div>
                </div>
        
        <button class="profile-edit-btn" id="editProfileBtnGlobal">
          <i class="fa-regular fa-pen-to-square"></i> Редактировать
        </button>
      </div>
      <div class="profile-tabs">
        <button class="profile-tab ${profileActiveTab === "posts" ? "active" : ""}" data-tab="posts">Мои объявления</button>
        <button class="profile-tab ${profileActiveTab === "invites" ? "active" : ""}" data-tab="invites">Приглашения</button>
      </div>
      <div class="profile-tab-content" id="profileTabContent"></div>
    `;

  document.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      profileActiveTab = tab.getAttribute("data-tab");
      renderProfileScreen();
    });
  });

  const editBtn = document.getElementById("editProfileBtnGlobal");
  if (editBtn) editBtn.onclick = () => showEditProfileModal();

  renderProfileTabContent();
}

function renderProfileTabContent() {
  const content = document.getElementById("profileTabContent");
  if (!content || !currentUser) return;

  if (profileActiveTab === "posts") {
    const userPosts = getUserPosts(currentUser.id, true);
    if (userPosts.length === 0) {
      content.innerHTML =
        '<div class="empty-state"><i class="fa-regular fa-newspaper"></i><p>У вас пока нет объявлений</p><button class="create-post-hint" id="createPostHint">Создать объявление</button></div>';
      const hintBtn = document.getElementById("createPostHint");
      if (hintBtn)
        hintBtn.onclick = () => document.getElementById("fabBtn")?.click();
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
          ${
            post.status === "active"
              ? `
            <div class="my-post-actions">
              <button class="action-edit" data-id="${post.id}"><i class="fa-regular fa-pen-to-square"></i> Редактировать</button>
              <button class="action-delete" data-id="${post.id}"><i class="fa-regular fa-trash-can"></i> Удалить</button>
            </div>
          `
              : `
            <div class="my-post-note">Объявление скрыто. Чтобы восстановить, обратитесь в поддержку.</div>
          `
          }
        </div>
      `,
      )
      .join("");

    document.querySelectorAll(".action-edit").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const postId = btn.getAttribute("data-id");
        const post = posts.find((p) => p.id === postId);
        if (post) showEditPostModal(post);
      });
    });

    document.querySelectorAll(".action-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const postId = btn.getAttribute("data-id");
        if (confirm("Удалить объявление?")) {
          await deletePost(postId);
          await loadPosts();
          renderProfileScreen();
          renderFeed();
        }
      });
    });
  } else if (profileActiveTab === "invites") {
    const invitedUsers = getInvitedUsers();
    const availableCount = getAvailableInvitesCount();

    content.innerHTML = `
        <div class="invites-stats">
          <div class="invites-count">Доступно инвайтов: <strong>${availableCount}</strong></div>
          <p class="invites-hint">1 базовый + 1 за каждого приглашённого</p>
          <button id="generateInviteFromProfile" class="invite-generate-btn"><i class="fa-regular fa-plus"></i> Создать инвайт-код</button>
          <div id="newInviteResult" class="invite-result"></div>
        </div>
        <div class="invited-list">
          <h4>Приглашённые вами</h4>
          ${
            invitedUsers.length === 0
              ? '<p class="empty-invites">Пока никого не пригласили</p>'
              : invitedUsers
                  .map(
                    (u) =>
                      `<div class="invited-item"><i class="fa-regular fa-user"></i><div><strong>${escapeHtml(u.name)}</strong><div class="invited-details">${escapeHtml(u.instruments || "")} ${escapeHtml(u.city ? "· " + u.city : "")}</div></div></div>`,
                  )
                  .join("")
          }
        </div>
      `;

    const generateInviteBtn = document.getElementById(
      "generateInviteFromProfile",
    );
    if (generateInviteBtn) {
      generateInviteBtn.onclick = async () => {
        const newCode = await createInvite();
        if (newCode) {
          const resultDiv = document.getElementById("newInviteResult");
          resultDiv.innerHTML = `<div class="invite-code-block"><code>${newCode}</code><button class="copy-code-btn">Копировать</button></div>`;
          resultDiv.querySelector(".copy-code-btn").onclick = () => {
            navigator.clipboard.writeText(newCode);
            alert("Код скопирован!");
          };
          setTimeout(() => {
            if (resultDiv) resultDiv.innerHTML = "";
          }, 15000);
        } else {
          alert("Не удалось создать инвайт");
        }
      };
    }
  }
}

function showEditPostModal(post) {
  const modalHtml = `
      <div class="modal" id="editPostModal" style="display: flex;">
        <div class="modal-card">
          <h3>Редактировать объявление</h3>
          <div class="form-group"><label>Заголовок</label><input type="text" id="editPostTitle" value="${escapeHtml(post.title)}"></div>
          <div class="form-group"><label>Описание</label><textarea id="editPostDesc" rows="4">${escapeHtml(post.description)}</textarea></div>
          <div class="form-group"><label>Теги (через запятую)</label><input type="text" id="editPostTags" value="${(post.tags || []).join(", ")}"></div>
          <div class="modal-buttons">
            <button class="btn-secondary" id="cancelEditPost">Отмена</button>
            <button class="btn-primary" id="saveEditPost">Сохранить</button>
          </div>
        </div>
      </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("editPostModal");

  document.getElementById("cancelEditPost").onclick = () => modal.remove();
  document.getElementById("saveEditPost").onclick = async () => {
    const title = document.getElementById("editPostTitle").value.trim();
    const description = document.getElementById("editPostDesc").value.trim();
    const tagsRaw = document.getElementById("editPostTags").value;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    if (!title || !description) {
      alert("Заголовок и описание обязательны");
      return;
    }

    await updatePost(post.id, { title, description, tags });
    await loadPosts();
    modal.remove();
    renderProfileScreen();
    renderFeed();
  };
}

function showEditProfileModal() {
  const modalHtml = `
      <div class="modal" id="editProfileModal" style="display: flex;">
        <div class="modal-card">
          <h3>Редактировать профиль</h3>
          <div class="form-group"><label>Имя</label><input type="text" id="editName" value="${escapeHtml(currentUser.name)}"></div>
          <div class="form-group"><label>Инструменты</label><input type="text" id="editInstruments" value="${escapeHtml(currentUser.instruments || "")}" placeholder="гитара, вокал..."></div>
          <div class="form-group"><label>Город</label><input type="text" id="editCity" value="${escapeHtml(currentUser.city || "")}" placeholder="Москва..."></div>
          <div class="form-group"><label>Жанры</label><input type="text" id="editGenres" value="${escapeHtml(currentUser.genres || "")}" placeholder="рок, джаз, металл..."></div>
          <div class="form-group"><label>О себе</label><textarea id="editAbout" rows="3">${escapeHtml(currentUser.about || "")}</textarea></div>
          <div class="modal-buttons">
            <button class="btn-secondary" id="cancelEdit">Отмена</button>
            <button class="btn-primary" id="saveEdit">Сохранить</button>
          </div>
        </div>
      </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("editProfileModal");

  document.getElementById("cancelEdit").onclick = () => modal.remove();
  document.getElementById("saveEdit").onclick = async () => {
    const updates = {
      name: document.getElementById("editName").value.trim(),
      instruments: document.getElementById("editInstruments").value.trim(),
      city: document.getElementById("editCity").value.trim(),
      genres: document.getElementById("editGenres").value.trim(),
      about: document.getElementById("editAbout").value.trim(),
    };
    if (updates.name) {
      await updateProfile(currentUser.id, updates);
      modal.remove();
      renderProfileScreen();
      renderFeed();
    } else {
      alert("Имя обязательно");
    }
  };
}
