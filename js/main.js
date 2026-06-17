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
  // Отправляем сообщение в реальный чат
  sendChatMessage(authorId, message);
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

// ========== СТАРТ ==========
async function startApp() {
  await initStorage();

  const savedUserId = localStorage.getItem('backstage_current_user');
  if (savedUserId) {
    try {
      const parsedUser = JSON.parse(savedUserId);
      const existingUser = users.find((u) => u.id === parsedUser.id);
      if (existingUser) {
        currentUser = existingUser;
        await loadFollowing();
        renderMainApp();
        
        // Проверяем, не перешли ли по ссылке на звонок
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId && roomId.startsWith('call_')) {
          // Открываем видео-комнату через 1 секунду после загрузки
          setTimeout(() => {
            startVideoLesson(roomId, false, null, null);
          }, 1000);
        }
        return;
      }
    } catch (e) {}
  }
  showAuthScreen();
}

startApp();
