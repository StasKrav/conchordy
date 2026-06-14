// Загрузить список подписок текущего пользователя
async function loadFollowing() {
  if (!currentUser) return;
  try {
    const response = await fetch(
      `${API_BASE}/follow/following/${currentUser.id}`,
    );
    if (response.ok) {
      const data = await response.json();
      followingIds = data.map((u) => u.id);
      console.log("📋 Загружены подписки:", followingIds.length);
    }
  } catch (e) {
    console.error("Ошибка загрузки подписок:", e);
    followingIds = [];
  }
}

// Подписаться
async function followUser(userId) {
  if (!currentUser) return false;
  try {
    const response = await fetch(`${API_BASE}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        follower_id: currentUser.id,
        following_id: userId,
      }),
    });
    if (response.ok) {
      followingIds.push(userId);
      // Обновляем счётчики в users
      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].followers_count =
          (users[userIndex].followers_count || 0) + 1;
      }
      if (currentUser.id === userId) {
        currentUser.following_count = (currentUser.following_count || 0) + 1;
      }
      renderProfileScreen();
      renderFeed();
      return true;
    }
  } catch (e) {
    console.error("Ошибка подписки:", e);
  }
  return false;
}

// Отписаться
async function unfollowUser(userId) {
  if (!currentUser) return false;
  try {
    const response = await fetch(`${API_BASE}/follow`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        follower_id: currentUser.id,
        following_id: userId,
      }),
    });
    if (response.ok) {
      followingIds = followingIds.filter((id) => id !== userId);
      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].followers_count = Math.max(
          0,
          (users[userIndex].followers_count || 0) - 1,
        );
      }
      renderProfileScreen();
      renderFeed();
      return true;
    }
  } catch (e) {
    console.error("Ошибка отписки:", e);
  }
  return false;
}

// Проверить, подписан ли на пользователя
function isFollowing(userId) {
  return followingIds.includes(userId);
}
