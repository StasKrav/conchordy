// ========== ПОИСК ==========
let searchQuery = "";
let searchTypeFilter = null;
let searchCity = "";
let searchGenre = "";
let searchActiveTab = "posts";

function performSearch() {
  let filteredPosts = posts.filter((p) => p.status === "active");

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredPosts = filteredPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query),
    );
  }

  if (searchTypeFilter) {
    filteredPosts = filteredPosts.filter((p) => p.type === searchTypeFilter);
  }

  if (searchCity) {
    filteredPosts = filteredPosts.filter((p) => {
      const author = users.find((u) => u.id === p.user_id);
      return (
        author &&
        author.city &&
        author.city.toLowerCase().includes(searchCity.toLowerCase())
      );
    });
  }

  if (searchGenre) {
    filteredPosts = filteredPosts.filter((p) => {
      const author = users.find((u) => u.id === p.user_id);
      return (
        author &&
        author.genres &&
        author.genres.toLowerCase().includes(searchGenre.toLowerCase())
      );
    });
  }

  let filteredUsers = users.filter((u) => u.id !== currentUser?.id);

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredUsers = filteredUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        (u.instruments && u.instruments.toLowerCase().includes(query)),
    );
  }

  if (searchCity) {
    filteredUsers = filteredUsers.filter(
      (u) => u.city && u.city.toLowerCase().includes(searchCity.toLowerCase()),
    );
  }

  if (searchGenre) {
    filteredUsers = filteredUsers.filter(
      (u) =>
        u.genres && u.genres.toLowerCase().includes(searchGenre.toLowerCase()),
    );
  }

  renderSearchResults(filteredPosts, filteredUsers);
}

function renderSearchResults(filteredPosts, filteredUsers) {
  const container = document.getElementById("searchResults");
  if (!container) return;

  if (searchActiveTab === "posts") {
    if (filteredPosts.length === 0) {
      container.innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--text-secondary);">Постов не найдено</div>';
      return;
    }

    container.innerHTML = filteredPosts
      .map((post) => {
        const author = users.find((u) => u.id === post.user_id);
        return `
          <div class="search-result-card" data-post-id="${post.id}">
            <div class="search-result-title">${getBadgeHTML(post.type)} ${escapeHtml(post.title)}</div>
            <div class="search-result-meta">
              <span class="clickable-name" data-user-id="${post.user_id}">${escapeHtml(author?.name || "Участник")}</span> · ${formatDate(post.created_at)}
              ${author?.city ? ` · ${escapeHtml(author.city)}` : ""}
              ${author?.genres ? ` · ${escapeHtml(author.genres)}` : ""}
            </div>
            <div class="search-result-meta" style="margin-top:6px;">${escapeHtml(post.description.substring(0, 100))}${post.description.length > 100 ? "..." : ""}</div>
          </div>
        `;
      })
      .join("");

    document
      .querySelectorAll(".search-result-card[data-post-id]")
      .forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.classList.contains("clickable-name")) return;
          const postId = card.getAttribute("data-post-id");
          const post = posts.find((p) => p.id === postId);
          if (post) {
            currentFilter = null;
            currentGenreFilter = null;
            renderFeed();
            setActiveScreen("feed");
            setTimeout(() => {
              const feedContainer = document.getElementById("feedList");
              if (feedContainer)
                feedContainer.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        });
      });

    document.querySelectorAll(".clickable-name").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const userId = el.getAttribute("data-user-id");
        viewUserProfile(userId);
      });
    });
  } else {
    if (filteredUsers.length === 0) {
      container.innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--text-secondary);">Пользователей не найдено</div>';
      return;
    }

    container.innerHTML = filteredUsers
      .map(
        (user) => `
        <div class="search-result-card" data-user-id="${user.id}">
          <div class="search-result-title clickable-name" data-user-id="${user.id}">${escapeHtml(user.name)}</div>
          <div class="search-result-meta">
            ${user.instruments ? escapeHtml(user.instruments) : "Инструменты не указаны"}
            ${user.city ? ` · ${escapeHtml(user.city)}` : ""}
            ${user.genres ? ` · ${escapeHtml(user.genres)}` : ""}
          </div>
          <div class="search-result-meta" style="margin-top:6px;">${user.about ? escapeHtml(user.about.substring(0, 100)) : "Нет описания"}</div>
        </div>
      `,
      )
      .join("");

    document.querySelectorAll(".search-result-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("clickable-name")) return;
        const userId = card.getAttribute("data-user-id");
        viewUserProfile(userId);
      });
    });

    document.querySelectorAll(".clickable-name").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const userId = el.getAttribute("data-user-id");
        viewUserProfile(userId);
      });
    });
  }
}

function renderSearchScreen() {
  const container = document.getElementById("searchScreen");
  if (!container) return;

  const cities = [...new Set(users.filter((u) => u.city).map((u) => u.city))];
  const genres = [
    ...new Set(
      users
        .filter((u) => u.genres)
        .flatMap((u) => u.genres.split(",").map((g) => g.trim())),
    ),
  ];

  container.innerHTML = `
      <div class="search-container">
        <div class="search-input-wrapper">
          <input type="text" id="searchInput" placeholder="Поиск по постам и пользователям..." value="${escapeHtml(searchQuery)}">
          <button id="searchBtn"><i class="fa-solid fa-search"></i></button>
        </div>
        
        <div class="search-filters">
          <select id="searchTypeFilter" class="search-filter-select">
            <option value="">Все типы</option>
            <option value="work" ${searchTypeFilter === "work" ? "selected" : ""}>Вакансии</option>
            <option value="gear" ${searchTypeFilter === "gear" ? "selected" : ""}>Оборудование</option>
            <option value="discourse" ${searchTypeFilter === "discourse" ? "selected" : ""}>Дискурс</option>
          </select>
          
          <select id="searchCity" class="search-filter-select">
            <option value="">Все города</option>
            ${cities.map((c) => `<option value="${escapeHtml(c)}" ${searchCity === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
          
          <select id="searchGenre" class="search-filter-select">
            <option value="">Все жанры</option>
            ${genres.map((g) => `<option value="${escapeHtml(g)}" ${searchGenre === g ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
          </select>
        </div>
        
        <div class="search-tabs">
          <div class="search-tab ${searchActiveTab === "posts" ? "active" : ""}" data-tab="posts">Посты</div>
          <div class="search-tab ${searchActiveTab === "users" ? "active" : ""}" data-tab="users">Пользователи</div>
        </div>
        
        <div id="searchResults" class="search-results-section"></div>
      </div>
    `;

  document.getElementById("searchBtn").onclick = () => {
    searchQuery = document.getElementById("searchInput").value;
    searchTypeFilter =
      document.getElementById("searchTypeFilter").value || null;
    searchCity = document.getElementById("searchCity").value;
    searchGenre = document.getElementById("searchGenre").value;
    performSearch();
  };

  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchQuery = e.target.value;
      searchTypeFilter =
        document.getElementById("searchTypeFilter").value || null;
      searchCity = document.getElementById("searchCity").value;
      searchGenre = document.getElementById("searchGenre").value;
      performSearch();
    }
  });

  document.getElementById("searchTypeFilter").onchange = () => {
    searchQuery = document.getElementById("searchInput").value;
    searchTypeFilter =
      document.getElementById("searchTypeFilter").value || null;
    searchCity = document.getElementById("searchCity").value;
    searchGenre = document.getElementById("searchGenre").value;
    performSearch();
  };

  document.getElementById("searchCity").onchange = () => {
    searchQuery = document.getElementById("searchInput").value;
    searchTypeFilter =
      document.getElementById("searchTypeFilter").value || null;
    searchCity = document.getElementById("searchCity").value;
    searchGenre = document.getElementById("searchGenre").value;
    performSearch();
  };

  document.getElementById("searchGenre").onchange = () => {
    searchQuery = document.getElementById("searchInput").value;
    searchTypeFilter =
      document.getElementById("searchTypeFilter").value || null;
    searchCity = document.getElementById("searchCity").value;
    searchGenre = document.getElementById("searchGenre").value;
    performSearch();
  };

  document.querySelectorAll(".search-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      searchActiveTab = tab.getAttribute("data-tab");
      renderSearchScreen();
      performSearch();
    });
  });

  performSearch();
}
