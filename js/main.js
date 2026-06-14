// ========== НАСТРОЙКИ ==========
const API_BASE = "http://localhost:3001/api";

// ========== ХРАНИЛИЩЕ ==========
let users = [];
let invites = [];
let posts = [];
let currentUser = null;
let currentGenreFilter = null;
let viewingUserId = null;
let currentFeedMode = "subscriptions"; // 'subscriptions' или 'all'
let followingIds = []; // ID пользователей, на кого подписан текущий пользователь

async function forgotPassword(email) {
  const response = await fetch(`${API_BASE}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response.json();
}

async function resetPassword(token, newPassword) {
  const response = await fetch(`${API_BASE}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  return response.json();
}

// ========== ЛОГИКА ПРИЛОЖЕНИЯ ==========
async function initStorage() {
  await loadInvites();
  await loadUsers();
  await loadPosts();
  if (currentUser) {
    await loadFollowing();
  }
}

function saveAllData() {
  if (currentUser) {
    localStorage.setItem("backstage_current_user", JSON.stringify(currentUser));
  }
}

function getUserById(id) {
  return users.find((u) => u.id === id);
}

function getAuthorName(userId) {
  const user = users.find((u) => u.id === userId);
  return user ? user.name : "Участник";
}

async function updateProfile(userId, updates) {
  const success = await updateUserOnServer(userId, updates);
  if (success) {
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      if (currentUser && currentUser.id === userId) {
        currentUser = users[userIndex];
        saveAllData();
      }
    }
    return true;
  }
  return false;
}

async function addPost(type, title, description, tagsRaw, audioUrl) {
  if (!currentUser) return false;
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);
  const newPost = {
    id: Date.now().toString(),
    user_id: currentUser.id,
    type: type,
    title: title,
    description: description,
    tags: JSON.stringify(tags),
    audio_url: audioUrl || null,
    created_at: Date.now(),
    status: "active",
  };
  const success = await savePostToServer(newPost);
  if (success) {
    posts.unshift({ ...newPost, tags: tags });
    return true;
  }
  return false;
}

async function updatePost(postId, updates) {
  const success = await updatePostOnServer(postId, updates);
  if (success) {
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      posts[postIndex] = { ...posts[postIndex], ...updates };
    }
    return true;
  }
  return false;
}

async function deletePost(postId) {
  const success = await deletePostOnServer(postId);
  if (success) {
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      posts[postIndex].status = "deleted";
    }
    return true;
  }
  return false;
}

function getUserPosts(userId, includeDeleted = false) {
  let userPosts = posts.filter((p) => p.user_id === userId);
  if (!includeDeleted) {
    userPosts = userPosts.filter((p) => p.status === "active");
  }
  return userPosts.sort((a, b) => b.created_at - a.created_at);
}

function sendMessageToAuthor(authorId, authorName, message) {
  console.log(
    `📨 Сообщение от ${currentUser.name} для ${authorName}: ${message}`,
  );
  alert(
    `Сообщение отправлено!\n\nКому: ${authorName}\nСообщение: ${message}\n\n(в реальном приложении здесь будет отправка на сервер и уведомление автору)`,
  );
}

// ========== UI КОМПОНЕНТЫ ==========
const typeIcons = {
  work: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.2" y="6.2" width="19.6" height="13.6" rx="2"/>
      <path d="M8.1 6.2 Q12 2.3 15.9 6.2"/>
    </svg>
    `,
  gear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <path d="M12 19v3"/>
    </svg>`,
  discourse: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`,
};

function getBadgeHTML(type) {
  const labels = {
    work: "вакансия",
    gear: "оборудование",
    discourse: "дискурс",
  };
  const classes = { work: "work", gear: "gear", discourse: "discourse" };
  return `<span class="badge-type ${classes[type]}" data-type="${type}">${typeIcons[type]}<span class="badge-text">${labels[type]}</span></span>`;
}

function setActiveScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(`${screenId}Screen`);
  if (target) target.classList.add("active");
  document
    .querySelectorAll(".nav-item")
    .forEach((nav) => nav.classList.remove("active"));
  const activeNav = document.querySelector(
    `.nav-item[data-screen="${screenId}"]`,
  );
  if (activeNav) activeNav.classList.add("active");

  if (screenId === "feed" || screenId === "search" || screenId === "profile") {
    viewingUserId = null;
  }

  if (screenId === "search") {
    renderSearchScreen();
  }
}

async function attachEvents() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const screen = btn.getAttribute("data-screen");

      navItems.forEach((nav) => nav.classList.remove("active"));
      btn.classList.add("active");

      document
        .querySelectorAll(".screen")
        .forEach((s) => s.classList.remove("active"));
      const targetScreen = document.getElementById(`${screen}Screen`);
      if (targetScreen) targetScreen.classList.add("active");

      if (screen === "profile") {
        viewingUserId = null;
        renderProfileScreen();
      }

      if (screen === "search") {
        renderSearchScreen();
      }
    });
  });

  document.querySelectorAll(".filter-badge").forEach((b) => {
    b.addEventListener("click", () => {
      const type = b.getAttribute("data-type");
      currentFilter = currentFilter === type ? null : type;
      renderFeed();
    });
  });

  document.querySelectorAll(".genre-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const genre = btn.getAttribute("data-genre");
      currentGenreFilter = genre === "" ? null : genre;
      renderFeed();
      document
        .querySelectorAll(".genre-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const resetBtn = document.getElementById("resetFilterBtn");
  if (resetBtn)
    resetBtn.onclick = () => {
      currentFilter = null;
      renderFeed();
    };

  document.addEventListener("click", (e) => {
    const badge = e.target.closest(".badge-type");
    if (badge && badge.getAttribute("data-type")) {
      const type = badge.getAttribute("data-type");
      currentFilter = currentFilter === type ? null : type;
      renderFeed();
    }
  });

  const fab = document.getElementById("fabBtn");
  const modal = document.getElementById("createModal");
  if (fab && modal) {
    fab.onclick = () => (modal.style.display = "flex");
    document.getElementById("cancelPost").onclick = () =>
      (modal.style.display = "none");

    let uploadedAudioUrl = null;
    const audioInput = document.getElementById("postAudio");
    const progressDiv = document.getElementById("audioUploadProgress");

    audioInput.addEventListener("change", async (e) => {
      const selectedFile = e.target.files[0];
      if (!selectedFile) return;

      if (selectedFile.size > 5 * 1024 * 1024) {
        progressDiv.innerHTML =
          '<span style="color:#c2410c;">Файл больше 5 MB</span>';
        audioInput.value = "";
        return;
      }

      progressDiv.innerHTML = "⏳ Загрузка...";
      const result = await uploadAudio(selectedFile);
      if (result.success) {
        uploadedAudioUrl = result.audioUrl;
        progressDiv.innerHTML = "Демо загружено";
        // Показываем имя файла
        const fileNameSpan = document.getElementById("audioFileName");
        if (fileNameSpan) fileNameSpan.textContent = selectedFile.name;
      } else {
        progressDiv.innerHTML =
          '<span style="color:#c2410c;">Ошибка загрузки</span>';
        audioInput.value = "";
      }
    });

    document.getElementById("submitPost").onclick = async () => {
      const type = document.getElementById("postType").value;
      const title = document.getElementById("postTitle").value.trim();
      const desc = document.getElementById("postDesc").value.trim();
      const tags = document.getElementById("postTags").value;

      if (!title || !desc) {
        alert("Заголовок и описание обязательны");
        return;
      }

      await addPost(type, title, desc, tags, uploadedAudioUrl);
      await loadPosts();
      modal.style.display = "none";
      document.getElementById("postTitle").value = "";
      document.getElementById("postDesc").value = "";
      document.getElementById("postTags").value = "";
      audioInput.value = "";
      uploadedAudioUrl = null;
      progressDiv.innerHTML = "";
      renderFeed();
      setActiveScreen("feed");
    };

    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };
  }

  const hamburger = document.getElementById("hamburgerBtn");
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  if (hamburger && menu && overlay) {
    hamburger.onclick = () => {
      menu.classList.add("open");
      overlay.style.display = "block";
    };
    overlay.onclick = () => {
      menu.classList.remove("open");
      overlay.style.display = "none";
    };
  }

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.getAttribute("data-action");
      const menuEl = document.getElementById("sideMenu");
      const overlayEl = document.getElementById("menuOverlay");
      if (menuEl) menuEl.classList.remove("open");
      if (overlayEl) overlayEl.style.display = "none";

      if (action === "logout") {
        currentUser = null;
        localStorage.removeItem("backstage_current_user");
        authMode = "login";
        showAuthScreen();
      } else if (action === "profile") {
        viewingUserId = null;
        setActiveScreen("profile");
        renderProfileScreen();
      } else if (action === "invites") {
        viewingUserId = null;
        setActiveScreen("profile");
        profileActiveTab = "invites";
        renderProfileScreen();
      } else if (action === "notifications") {
        alert("Уведомления скоро появятся");
      } else if (action === "about") {
        window.location.href = "about.html";
      } else if (action === "live") {
        showCreateRoomModal();
      }
    });
  });

  // Переключение вкладок подписок
  const feedTabs = document.querySelectorAll(".feed-tab");
  feedTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.getAttribute("data-feed");
      if (mode === "subscriptions") {
        currentFeedMode = "subscriptions";
      } else {
        currentFeedMode = "all";
      }

      feedTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderFeed();
    });
  });
}

// ========== СТАРТ ==========
async function startApp() {
  await initStorage();

  const savedUserId = localStorage.getItem("backstage_current_user");
  if (savedUserId) {
    try {
      const parsedUser = JSON.parse(savedUserId);
      const existingUser = users.find((u) => u.id === parsedUser.id);
      if (existingUser) {
        currentUser = existingUser;
        await loadFollowing();
        renderMainApp();
        return;
      }
    } catch (e) {}
  }
  showAuthScreen();
}

startApp();
