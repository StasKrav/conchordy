// ========== МАРКЕТ (ПРОДАЖА ЛИЦЕНЗИЙ) ==========

let marketActiveTab = 'buy'; // 'buy', 'my-products', 'history'

function renderMarketScreen() {
  const container = document.getElementById('marketScreen');
  if (!container) return;
  
  container.innerHTML = `
    <div class="market-container">
      <div class="market-tabs">
        <button class="market-tab ${marketActiveTab === 'buy' ? 'active' : ''}" data-tab="buy">
          <i class="fa-regular fa-cart-shopping"></i> Купить
        </button>
        <button class="market-tab ${marketActiveTab === 'my-products' ? 'active' : ''}" data-tab="my-products">
          <i class="fa-regular fa-box"></i> Мои товары
        </button>
        <button class="market-tab ${marketActiveTab === 'history' ? 'active' : ''}" data-tab="history">
          <i class="fa-regular fa-clock-rotate-left"></i> История
        </button>
      </div>
      
      <div class="market-content" id="marketContent"></div>
    </div>
  `;
  
  // Обработчики вкладок
  document.querySelectorAll('.market-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      marketActiveTab = tab.getAttribute('data-tab');
      renderMarketScreen();
    });
  });
  
  // Рендерим содержимое вкладки
  renderMarketTabContent();
}

function renderMarketTabContent() {
  const content = document.getElementById('marketContent');
  if (!content) return;
  
  if (marketActiveTab === 'buy') {
    renderBuyTab(content);
  } else if (marketActiveTab === 'my-products') {
    renderMyProductsTab(content);
  } else if (marketActiveTab === 'history') {
    renderHistoryTab(content);
  }
}

// Вкладка "Купить" — лента доступных лицензий
async function renderBuyTab(container) {
  // Загружаем посты с ценой > 0
  let licensePosts = [];
  try {
    const response = await fetch(`${API_BASE}/posts?license=true`);
    if (response.ok) {
      licensePosts = await response.json();
    }
  } catch (e) {
    console.error('Ошибка загрузки товаров:', e);
  }
  
  if (licensePosts.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <i class="fa-regular fa-store-slash"></i>
        <p>Пока нет товаров в продаже</p>
        <small>Будьте первым, кто выставит бит или лицензию!</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="market-products-list">
      ${licensePosts.map(post => `
        <div class="market-product-card" data-post-id="${post.id}">
          <div class="product-header">
            ${getBadgeHTML(post.type)}
            <span class="product-price">${post.license_price || 500} ₽</span>
          </div>
          <div class="product-title">${escapeHtml(post.title)}</div>
          <div class="product-author">
            <i class="fa-regular fa-user"></i> ${escapeHtml(getAuthorName(post.user_id))}
          </div>
          <div class="product-desc">${escapeHtml(post.description.substring(0, 100))}${post.description.length > 100 ? '...' : ''}</div>
          ${post.audio_url ? `
            <div class="product-demo">
              <button class="play-demo-btn market-play" data-audio-url="${post.audio_url}">
                <i class="fa-solid fa-music"></i> Демо
              </button>
              <audio class="demo-audio" style="display: none;">
                <source src="${post.audio_url}" type="audio/mpeg">
              </audio>
            </div>
          ` : ''}
          <button class="buy-license-btn" data-post-id="${post.id}" data-price="${post.license_price || 500}">
            <i class="fa-regular fa-cart-plus"></i> Купить лицензию
          </button>
        </div>
      `).join('')}
    </div>
  `;
  
  // Инициализация демо-плееров
  container.querySelectorAll('.play-demo-btn').forEach(btn => {
    const demoDiv = btn.parentElement;
    const audio = demoDiv.querySelector('.demo-audio');
    if (!audio) return;
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (audio.paused) {
        audio.play();
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Демо';
      } else {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-music"></i> Демо';
      }
    });
  });
  
  // Обработчики покупки
  container.querySelectorAll('.buy-license-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-post-id');
      const price = btn.getAttribute('data-price');
      showLicensePurchaseModal(postId, price);
    });
  });
}

// Вкладка "Мои товары" — управление продажами
function renderMyProductsTab(container) {
  const myPosts = getUserPosts(currentUser?.id, false).filter(p => p.license_price > 0);
  
  if (myPosts.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <i class="fa-regular fa-box-open"></i>
        <p>У вас нет товаров в продаже</p>
        <button class="create-product-btn" id="createProductBtn">
          <i class="fa-regular fa-plus"></i> Выставить бит на продажу
        </button>
      </div>
    `;
    document.getElementById('createProductBtn')?.addEventListener('click', () => {
      document.getElementById('fabBtn')?.click();
    });
    return;
  }
  
  container.innerHTML = `
    <div class="market-products-list">
      ${myPosts.map(post => `
        <div class="market-product-card" data-post-id="${post.id}">
          <div class="product-header">
            ${getBadgeHTML(post.type)}
            <span class="product-price">${post.license_price} ₽</span>
          </div>
          <div class="product-title">${escapeHtml(post.title)}</div>
          <div class="product-stats">
            <span><i class="fa-regular fa-chart-simple"></i> ${post.license_sales_count || 0} продаж</span>
            <span><i class="fa-regular fa-clock"></i> ${formatDate(post.created_at)}</span>
          </div>
          <div class="product-actions">
            <button class="edit-product-btn" data-post-id="${post.id}">
              <i class="fa-regular fa-pen-to-square"></i> Редактировать
            </button>
            <button class="remove-product-btn" data-post-id="${post.id}">
              <i class="fa-regular fa-trash-can"></i> Снять с продажи
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="add-product-fab" id="addProductFab">
      <i class="fa-regular fa-plus"></i> Выставить бит
    </button>
  `;
  
  document.getElementById('addProductFab')?.addEventListener('click', () => {
    document.getElementById('fabBtn')?.click();
  });
}

// Вкладка "История" — покупки и продажи
async function renderHistoryTab(container) {
  // Заглушка — потом подключим реальные данные
  container.innerHTML = `
    <div class="market-empty">
      <i class="fa-regular fa-clock-rotate-left"></i>
      <p>История покупок и продаж</p>
      <small>Скоро здесь появятся ваши транзакции</small>
    </div>
  `;
}

// Модальное окно покупки лицензии
function showLicensePurchaseModal(postId, price) {
  const modalHtml = `
    <div class="modal" id="licenseModal" style="display: flex;">
      <div class="modal-card">
        <h3>💰 Покупка лицензии</h3>
        <div class="form-group">
          <label>Тип лицензии</label>
          <select id="licenseType">
            <option value="non-exclusive">Non-exclusive (неисключительная) — ${price} ₽</option>
            <option value="exclusive">Exclusive (исключительная) — ${price * 5} ₽</option>
          </select>
        </div>
        <div class="form-group">
          <label>Сообщение продавцу (необязательно)</label>
          <textarea id="licenseMessage" rows="2" placeholder="Например: хочу использовать в коммерческом релизе"></textarea>
        </div>
        <div class="modal-buttons">
          <button class="btn-secondary" id="cancelLicenseBtn">Отмена</button>
          <button class="btn-primary" id="confirmLicenseBtn">Оплатить ${price} ₽</button>
        </div>
        <p style="font-size: 11px; color: var(--text-secondary); margin-top: 12px; text-align: center;">
          ℹ️ Тестовый режим: деньги не списываются
        </p>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('licenseModal');
  
  const licenseType = document.getElementById('licenseType');
  const confirmBtn = document.getElementById('confirmLicenseBtn');
  
  licenseType.addEventListener('change', () => {
    const isExclusive = licenseType.value === 'exclusive';
    const newPrice = isExclusive ? price * 5 : price;
    confirmBtn.innerHTML = `Оплатить ${newPrice} ₽`;
  });
  
  document.getElementById('cancelLicenseBtn').onclick = () => modal.remove();
  confirmBtn.onclick = async () => {
    const type = licenseType.value;
    const message = document.getElementById('licenseMessage').value.trim();
    
    // Здесь будет запрос на покупку
    alert(`[ТЕСТ] Покупка лицензии ${type}\nСумма: ${type === 'exclusive' ? price * 5 : price} ₽\nСообщение: ${message || '—'}`);
    modal.remove();
  };
}
