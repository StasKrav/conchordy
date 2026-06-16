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
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const screen = btn.getAttribute('data-screen');
      
      navItems.forEach(nav => nav.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const targetScreen = document.getElementById(`${screen}Screen`);
      if (targetScreen) targetScreen.classList.add('active');
      
      const fab = document.getElementById('fabBtn');
      
      if (screen === 'feed') {
        if (fab) fab.style.display = 'flex';
        renderFeed();
      }
      
      if (screen === 'search') {
        if (fab) fab.style.display = 'flex';
        renderSearchScreen();
      }
      
      if (screen === 'profile') {
        if (fab) fab.style.display = 'flex';
        viewingUserId = null;
        renderProfileScreen();
      }
      
      if (screen === 'market') {
        if (fab) fab.style.display = 'none';
        if (typeof renderMarketScreen === 'function') {
          renderMarketScreen();
        }
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

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.getAttribute('data-action');
      const menuEl = document.getElementById('sideMenu');
      const overlayEl = document.getElementById('menuOverlay');
      
      if (menuEl) menuEl.classList.remove('open');
      if (overlayEl) overlayEl.style.display = 'none';
      
      if (action === 'logout') {
        currentUser = null;
        localStorage.removeItem('backstage_current_user');
        authMode = 'login';
        showAuthScreen();
      } else if (action === 'profile') {
        viewingUserId = null;
        setActiveScreen('profile');
        renderProfileScreen();
      } else if (action === 'invites') {
        viewingUserId = null;
        setActiveScreen('profile');
        profileActiveTab = 'invites';
        renderProfileScreen();
      } else if (action === 'notifications') {
        alert('Уведомления скоро появятся');
      } else if (action === 'about') {
        window.location.href = 'about.html';
      } else if (action === 'audio-room') {
        showCreateRoomModal('audio');
      } else if (action === 'video-room') {
        showCreateVideoRoomModal();
      } else if (action === 'market') {
        setActiveScreen('market');
        if (typeof renderMarketScreen === 'function') {
          renderMarketScreen();
        }
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

