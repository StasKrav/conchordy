// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadInvites() {
  const response = await fetch(`${API_BASE}/invites`, { cache: "no-store" });
  invites = await response.json();
  console.log("📋 Загружены инвайты:", invites);
}

async function loadUsers() {
  const response = await fetch(`${API_BASE}/users`);
  users = await response.json();
  console.log("👥 Загружены пользователи:", users);
}

async function loadPosts() {
  const response = await fetch(`${API_BASE}/posts`);
  const rawPosts = await response.json();
  posts = rawPosts.map((p) => ({ ...p, tags: JSON.parse(p.tags) }));
  console.log("📝 Загружены посты:", posts.length);
}

// ========== АУТЕНТИФИКАЦИЯ ==========
async function login(email, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

async function register(
  email,
  password,
  name,
  inviteCode,
  instruments,
  city,
  about,
  genres,
) {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name,
      inviteCode,
      instruments,
      city,
      about,
      genres,
    }),
  });
  return response.json();
}

async function uploadAudio(file) {
  const formData = new FormData();
  formData.append("audio", file);

  const response = await fetch(`${API_BASE}/upload-audio`, {
    method: "POST",
    body: formData,
  });
  return response.json();
}

// ========== СОХРАНЕНИЕ ==========
async function updateUserOnServer(userId, updates) {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return response.ok;
}

async function savePostToServer(post) {
  const response = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  return response.ok;
}

async function updatePostOnServer(postId, updates) {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return response.ok;
}

async function deletePostOnServer(postId) {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
  });
  return response.ok;
}

async function saveInviteToServer(code, createdBy) {
  const response = await fetch(`${API_BASE}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, created_by: createdBy }),
  });
  return response.ok;
}
