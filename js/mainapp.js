// ========== ОСНОВНОЕ ПРИЛОЖЕНИЕ ==========
function renderMainApp() {
  const root = document.getElementById("appRoot");

  const allGenres = new Set();
  users.forEach((u) => {
    if (u.genres) {
      u.genres.split(",").forEach((g) => {
        const genre = g.trim();
        if (genre) allGenres.add(genre);
      });
    }
  });
  const genreList = Array.from(allGenres);

  root.innerHTML = `
      <div>
        <header class="app-header">
          <div class="logo" style="display: flex; align-items: flex-end; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 200 200" width="36" height="36">
              <path fill="none" stroke="#d96c4a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" 
                    d="M 160.70997,58.064358 A 58.699776,57.871372 0 0 1 110.9398,115.26219 58.699776,57.871372 0 0 1 46.027222,75.466614 58.699776,57.871372 0 0 1 76.047947,6.1611009 58.699776,57.871372 0 0 1 150.09424,24.870704" 
                    transform="matrix(0.94565764,0.325164,-0.33590158,0.94189709,0,0)"/>
              <path fill="none" stroke="#d96c4a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" 
                    d="m -75.342331,-42.141541 a 34.257706,33.912876 0 0 1 -25.391159,32.7573235 34.257706,33.912876 0 0 1 -38.53459,-15.8008855 34.257706,33.912876 0 0 1 5.44419,-40.936463 34.257706,33.912876 0 0 1 41.352708,-5.389386" 
                    transform="matrix(-0.88582572,-0.4640181,0.47738135,-0.87869622,0,0)"/>
            </svg>
            <span style="line-height: 1;">Chiuso<span style="color: var(--accent);">Club</span></span>
          </div>
          <button class="hamburger" id="hamburgerBtn" style="display: flex; align-items: flex-end; justify-content: center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </header>
        
        <div class="main-content">
          <!-- FEED SCREEN -->
          <div class="screen active" id="feedScreen">
            <div class="feed-tabs">
              <button class="feed-tab active" data-feed="subscriptions">
                 Подписки
              </button>
              <button class="feed-tab" data-feed="all">
                 Все посты
              </button>
            </div>
            
            <div class="filters-bar">
              <span class="filter-badge work" data-type="work">${typeIcons.work}<span>вакансия</span></span>
              <span class="filter-badge gear" data-type="gear">${typeIcons.gear}<span>оборудование</span></span>
              <span class="filter-badge discourse" data-type="discourse">${typeIcons.discourse}<span>дискурс</span></span>
              <button class="reset-filter" id="resetFilterBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg> 
                всё 
              </button>
            </div>
            
            ${
              genreList.length > 0
                ? `
              <div class="genres-filter">
                <span style="font-size:0.7rem; color:var(--text-secondary);">Фильтр по жанрам:</span>
                <button class="genre-filter-btn ${currentGenreFilter === null ? "active" : ""}" data-genre="">Все</button>
                ${genreList.map((g) => `<button class="genre-filter-btn ${currentGenreFilter === g ? "active" : ""}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join("")}
              </div>
            `
                : ""
            }
            
            <div class="feed-list" id="feedList"></div>
          </div>
          

          <div class="screen" id="searchScreen"></div>
          <div class="screen" id="profileScreen"></div>
          <div class="screen" id="liveScreen"></div>
          <div class="screen" id="roomScreen"></div>
        </div>
        
        <nav class="bottom-nav">
          <a href="#" class="nav-item active" data-screen="feed"><i class="fa-regular fa-rectangle-list nav-icon"></i><span>Лента</span></a>
          <a href="#" class="nav-item" data-screen="search"><i class="fa-regular fa-compass nav-icon"></i><span>Поиск</span></a>
          <a href="#" class="nav-item" data-screen="profile"><i class="fa-regular fa-user nav-icon"></i><span>Профиль</span></a>
        </nav>
        
        <button class="fab" id="fabBtn">+</button>
        
        <div class="modal" id="createModal">
          <div class="modal-card">
            <h3>Новая публикация</h3>
            <div class="form-group"><label>Тип</label><select id="postType"><option value="work">Вакансия / проект</option><option value="gear">Оборудование</option><option value="discourse">Дискурс</option></select></div>
            <div class="form-group"><label>Заголовок</label><input id="postTitle" placeholder="например: Ищем басиста"></div>
            <div class="form-group"><label>Описание</label><textarea id="postDesc" rows="3" placeholder="Подробности, условия..."></textarea></div>
            <div class="form-group"><label>Теги (через запятую)</label><input id="postTags" placeholder="гитара, сессия, студия"></div>
            <div class="form-group">
              <label>Демо (MP3, до 5 MB)</label>
              <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 12px;">
                <label class="custom-file-upload">
                  Выбрать файл
                  <input type="file" id="postAudio" accept="audio/mpeg" style="display: none;">
                </label>
                <span id="audioFileName" class="file-name">Файл не выбран</span>
              </div>
              <div id="audioUploadProgress" class="audio-upload-progress"></div>
            </div>
            <div class="modal-buttons"><button class="btn-secondary" id="cancelPost">Отмена</button><button class="btn-primary" id="submitPost">Опубликовать</button></div>
          </div>
        </div>
        
        <div class="menu-overlay" id="menuOverlay"></div>
        
        <div class="side-menu" id="sideMenu">
          <div class="menu-item" data-action="profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Мой профиль</span>
          </div>
          
          <div class="menu-item" data-action="invites">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <polyline points="22 7 12 13 2 7"/>
            </svg>
            <span>Приглашения</span>
          </div>
          
          <div class="menu-item" data-action="notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Уведомления</span>
          </div>

          <div class="menu-item" data-action="live">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
            </svg>
            <span>Начать эфир</span>
          </div>
  
          <div class="menu-item" id="themeMenuItem">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <span>Тема: <span id="themeStatus">Светлая</span></span>
          </div>
  
          <div class="menu-item" data-action="about">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>О проекте</span>
          </div>
          
          <div style="margin: 16px 0; border-top: 1px solid var(--border-light);"></div>
          
          <div class="menu-item" data-action="logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Выйти</span>
          </div>
        </div>
      </div>
    `;

  renderFeed();
  attachEvents();
  renderProfileScreen();
}
