// ========== МАРКЕТ (ПРОДАЖА ЛИЦЕНЗИЙ) ==========

let marketActiveTab = 'buy'; // 'buy', 'my-products', 'history'

function renderMarketScreen() {
  const container = document.getElementById('marketScreen');
  if (!container) return;
  
  container.innerHTML = `
    <div class="market-container">
      <div class="market-tabs">
        <button class="market-tab ${marketActiveTab === 'buy' ? 'active' : ''}" data-tab="buy">
           Купить
        </button>
        <button class="market-tab ${marketActiveTab === 'my-products' ? 'active' : ''}" data-tab="my-products">
           Мои товары
        </button>
        <button class="market-tab ${marketActiveTab === 'history' ? 'active' : ''}" data-tab="history">
           История
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
// Вкладка "Купить" — лента товаров из БД
async function renderBuyTab(container) {
  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Ошибка загрузки');
    const products = await response.json();
    
    if (products.length === 0) {
      container.innerHTML = `
        <div class="market-empty">
          <svg width="102" height="100" viewBox="0 0 501.33333333333337 499.94731704899027" xmlns="http://www.w3.org/2000/svg">
          <path d="M80,158.18601628434308 L114.13333333333334,260.5860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <path d="M80,158.18601628434308 L353.06666666666666,158.18601628434308" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <path d="M387.2,124.05268295100974 L318.93333333333334,328.85268295100974" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <path d="M114.13333333333334,260.5860162843431 L318.93333333333334,260.5860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <path d="M318.93333333333334,328.85268295100974 L120.53333333333333,327.7860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <path d="M387.2,124.05268295100974 L421.33333333333337,124.05268295100974" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          <circle cx="302.93333333333334" cy="402.45268295100976" r="17.49463409798051" stroke="currentColor" stroke-width="32" fill="none"/>
          <circle cx="154.66666666666669" cy="401.3860162843431" r="17.88059158852289" stroke="currentColor" stroke-width="32" fill="none"/>
          <path d="M90.66666666666667,80 L410.6666666666667,368" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
          
          </svg>
          <p>Пока нет товаров в продаже</p>
          <small>Будьте первым, кто выставит бит или лицензию!</small>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="market-products-list">
        ${products.map(product => `
          <div class="market-product-card" data-product-id="${product.id}">
            <div class="product-header">
              <span class="product-badge">Бит</span>
              <span class="product-price">${product.price} ₽</span>
            </div>
            <div class="product-title">${escapeHtml(product.title)}</div>
            <div class="product-author">
              <svg width="16" height="16" viewBox="0 0 292 305.25483399593907" xmlns="http://www.w3.org/2000/svg">
              <circle cx="146" cy="95.25483399593904" r="45.254833995939045" stroke="currentColor" stroke-width="20" fill="none"/>
              <path d="M50,255.25483399593904 C50,159.25483399593904 242,159.25483399593904 242,255.25483399593904" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M50,255.25483399593904 L242,255.25483399593904" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              
              </svg> ${escapeHtml(product.seller_name)}
            </div>
            <div class="product-desc">${escapeHtml(product.description?.substring(0, 100) || '')}${product.description?.length > 100 ? '...' : ''}</div>
            <div class="product-license">
              <svg width="16" height="16" viewBox="0 0 260 292" xmlns="http://www.w3.org/2000/svg">
              <path d="M50,50 L146,50" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M146,50 L146,114" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M146,114 L210,114" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M146,50 L210,114" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M210,114 L210,242" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M210,242 L50,242" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M50,242 L50,50" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M82,146 L114,146" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M82,178 L146,178" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
              
              </svg>
               ${product.license_type === 'exclusive' ? 'Исключительная лицензия' : 'Неисключительная лицензия'}
            </div>
            ${product.demo_url ? `
              <div class="product-demo">
                <button class="play-demo-btn market-play" data-audio-url="${product.demo_url}">
                  <i class="fa-solid fa-music"></i> Демо
                </button>
                <audio class="demo-audio" style="display: none;">
                  <source src="${product.demo_url}" type="audio/mpeg">
                </audio>
              </div>
            ` : ''}
            <button class="buy-license-btn" data-product-id="${product.id}" data-price="${product.price}">
              Купить лицензию
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
        const productId = btn.getAttribute('data-product-id');
        const price = btn.getAttribute('data-price');
        showLicensePurchaseModal(productId, price);
      });
    });
    
  } catch (e) {
    console.error('Ошибка загрузки товаров:', e);
    container.innerHTML = `
      <div class="market-empty">
        <i class="fa-regular fa-circle-exclamation"></i>
        <p>Ошибка загрузки</p>
        <small>Попробуйте позже</small>
      </div>
    `;
  }
}

// Вкладка "Мои товары" — управление продажами
async function renderMyProductsTab(container) {
  if (!currentUser) {
    container.innerHTML = '<div class="market-empty">Войдите в аккаунт, чтобы управлять товарами</div>';
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/products/my/${currentUser.id}`);
    if (!response.ok) throw new Error('Ошибка загрузки');
    const products = await response.json();
    
    if (products.length === 0) {
      container.innerHTML = `
        <div class="market-empty">
          <svg width="102" height="100" viewBox="0 0 501.33333333333337 499.94731704899027" xmlns="http://www.w3.org/2000/svg">
                    <path d="M80,158.18601628434308 L114.13333333333334,260.5860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <path d="M80,158.18601628434308 L353.06666666666666,158.18601628434308" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <path d="M387.2,124.05268295100974 L318.93333333333334,328.85268295100974" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <path d="M114.13333333333334,260.5860162843431 L318.93333333333334,260.5860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <path d="M318.93333333333334,328.85268295100974 L120.53333333333333,327.7860162843431" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <path d="M387.2,124.05268295100974 L421.33333333333337,124.05268295100974" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    <circle cx="302.93333333333334" cy="402.45268295100976" r="17.49463409798051" stroke="currentColor" stroke-width="32" fill="none"/>
                    <circle cx="154.66666666666669" cy="401.3860162843431" r="17.88059158852289" stroke="currentColor" stroke-width="32" fill="none"/>
                    <path d="M90.66666666666667,80 L410.6666666666667,368" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
                    
                    </svg>
          <p>У вас нет товаров в продаже</p>
          <button class="create-product-btn" id="createProductBtn">
             Выставить бит на продажу
          </button>
        </div>
      `;
      document.getElementById('createProductBtn')?.addEventListener('click', () => {
        showCreateProductModal();
      });
      return;
    }
    
    container.innerHTML = `
      <div class="market-products-list">
        ${products.map(product => `
          <div class="market-product-card" data-product-id="${product.id}">
            <div class="product-header">
              <span class="product-badge">Бит</span>
              <span class="product-price">${product.price} ₽</span>
            </div>
            <div class="product-title">${escapeHtml(product.title)}</div>
            <div class="product-stats">
              <span> ${product.sales_count || 0} продаж</span>
              <span> ${formatDate(product.created_at)}</span>
            </div>
            <div class="product-actions">
              <button class="remove-product-btn" data-product-id="${product.id}">
                Снять с продажи
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
      showCreateProductModal();
    });
    
    // Обработчики удаления
    container.querySelectorAll('.remove-product-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const productId = btn.getAttribute('data-product-id');
        if (confirm('Снять этот бит с продажи?')) {
          await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
          });
          renderMarketScreen(); // Обновляем страницу
        }
      });
    });
    
  } catch (e) {
    console.error('Ошибка загрузки товаров:', e);
    container.innerHTML = '<div class="market-empty">Ошибка загрузки</div>';
  }
}

// Вкладка "История" — покупки и продажи
async function renderHistoryTab(container) {
  // Заглушка — потом подключим реальные данные
  container.innerHTML = `
    <div class="market-empty">
      <svg width="100" height="110" viewBox="0 0 420 452" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,50 L370,50 L370,402 L50,402 Z" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M114,114 L114,114" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M178,114 L306,114" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M178,178 L306,178" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M178,242 L306,242" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M178,306 L306,306" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M114,178 L114,178" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M114,242 L114,242" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      <path d="M114,306 L114,306" stroke="currentColor" stroke-width="32" fill="none" stroke-linecap="round"/>
      
      </svg>
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
        <h3>Покупка лицензии</h3>
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

// ========== СОЗДАНИЕ ТОВАРА ==========

let uploadedDemoUrl = null;
let uploadedFullUrl = null;

function showCreateProductModal() {
  // Сбрасываем предыдущие загрузки
  uploadedDemoUrl = null;
  uploadedFullUrl = null;
  
  const modalHtml = `
    <div class="modal product-modal" id="createProductModal" style="display: flex;">
      <div class="modal-card">
        <h3>Выставить бит на продажу</h3>
        
        <div class="form-group">
          <label>Название трека <span class="accent-text">*</span></label>
          <input type="text" id="productTitle" placeholder="например: Супер-бит 2025">
        </div>
        
        <div class="form-group">
          <label>Описание</label>
          <textarea id="productDesc" rows="3" placeholder="BPM, тональность, стиль, особенности..."></textarea>
        </div>
        
        <div class="form-group">
          <label>Цена (₽) <span class="accent-text">*</span></label>
          <input type="number" id="productPrice" placeholder="500" min="50" step="50" value="500">
        </div>
        
        <div class="form-group">
          <label>Тип лицензии</label>
          <select id="productLicenseType">
            <option value="non-exclusive">Non-exclusive (неисключительная)</option>
            <option value="exclusive">Exclusive (исключительная) — цена ×5</option>
          </select>
          <span class="license-type-hint">
            <svg width="20" height="20" viewBox="0 0 164 164" xmlns="http://www.w3.org/2000/svg">
            <path d="M50,82 L114,82" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
            <path d="M82,50 L114,82" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
            <path d="M114,82 L82,114" stroke="currentColor" stroke-width="20" fill="none" stroke-linecap="round"/>
            
            </svg>
            Non-exclusive — вы можете продавать бит нескольким покупателям. 
            Exclusive — только одному покупателю (цена выше).
          </span>
        </div>
        
        <div class="form-group">
          <label>Демо-файл (MP3, с водяным знаком) <span class="accent-text">*</span></label>
          <div class="file-upload-wrapper">
            <button type="button" class="file-upload-btn" id="demoUploadBtn">
              Выбрать файл
            </button>
            <input type="file" id="productDemoFile" accept="audio/mpeg" style="display: none;">
            <span id="demoFileName" class="file-name">Файл не выбран</span>
          </div>
          <div id="demoUploadProgress" class="upload-progress"></div>
        </div>
        
        <div class="form-group">
          <label>Полный файл (WAV/MP3, без водяных знаков) <span class="accent-text">*</span></label>
          <div class="file-upload-wrapper">
            <button type="button" class="file-upload-btn" id="fullUploadBtn">
              Выбрать файл
            </button>
            <input type="file" id="productFullFile" accept="audio/mpeg,audio/wav" style="display: none;">
            <span id="fullFileName" class="file-name">Файл не выбран</span>
          </div>
          <div id="fullUploadProgress" class="upload-progress"></div>
        </div>
        
        <div class="modal-buttons">
          <button class="btn-secondary" id="cancelProductBtn">Отмена</button>
          <button class="btn-primary" id="submitProductBtn">Выставить на продажу</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('createProductModal');
  
  // Закрытие по крестику или оверлею
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.getElementById('cancelProductBtn').onclick = () => modal.remove();
  
  // Загрузка демо-файла
  const demoUploadBtn = document.getElementById('demoUploadBtn');
  const demoInput = document.getElementById('productDemoFile');
  const demoFileName = document.getElementById('demoFileName');
  const demoProgress = document.getElementById('demoUploadProgress');
  
  demoUploadBtn.addEventListener('click', () => {
    demoInput.click();
  });
  
  demoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      demoProgress.innerHTML = '<span style="color:#c2410c;">Файл больше 10 MB</span>';
      return;
    }
    
    demoFileName.textContent = file.name;
    demoProgress.innerHTML = '⏳ Загрузка демо...';
    
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
      const response = await fetch(`${API_BASE}/upload-product-demo`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        uploadedDemoUrl = result.audioUrl;
        demoProgress.innerHTML = '✅ Демо загружено';
      } else {
        demoProgress.innerHTML = '<span style="color:#c2410c;">Ошибка загрузки</span>';
      }
    } catch (err) {
      console.error(err);
      demoProgress.innerHTML = '<span style="color:#c2410c;">Ошибка сети</span>';
    }
  });
  
  // Загрузка полного файла
  const fullUploadBtn = document.getElementById('fullUploadBtn');
  const fullInput = document.getElementById('productFullFile');
  const fullFileName = document.getElementById('fullFileName');
  const fullProgress = document.getElementById('fullUploadProgress');
  
  fullUploadBtn.addEventListener('click', () => {
    fullInput.click();
  });
  
  fullInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
      fullProgress.innerHTML = '<span style="color:#c2410c;">Файл больше 50 MB</span>';
      return;
    }
    
    fullFileName.textContent = file.name;
    fullProgress.innerHTML = '⏳ Загрузка полного файла...';
    
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
      const response = await fetch(`${API_BASE}/upload-product-full`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        uploadedFullUrl = result.audioUrl;
        fullProgress.innerHTML = '✅ Полный файл загружен';
      } else {
        fullProgress.innerHTML = '<span style="color:#c2410c;">Ошибка загрузки</span>';
      }
    } catch (err) {
      console.error(err);
      fullProgress.innerHTML = '<span style="color:#c2410c;">Ошибка сети</span>';
    }
  });
  
  // Отправка формы
  document.getElementById('submitProductBtn').onclick = async () => {
    const title = document.getElementById('productTitle').value.trim();
    const description = document.getElementById('productDesc').value.trim();
    const price = parseInt(document.getElementById('productPrice').value);
    const licenseType = document.getElementById('productLicenseType').value;
    
    if (!title) {
      alert('Введите название трека');
      return;
    }
    
    if (isNaN(price) || price < 50) {
      alert('Минимальная цена 50 ₽');
      return;
    }
    
    if (!uploadedDemoUrl) {
      alert('Загрузите демо-файл');
      return;
    }
    
    if (!uploadedFullUrl) {
      alert('Загрузите полный файл');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          title: title,
          description: description,
          price: price,
          license_type: licenseType,
          demo_url: uploadedDemoUrl,
          full_url: uploadedFullUrl
        })
      });
      
      if (response.ok) {
        alert('✅ Товар успешно выставлен на продажу!');
        modal.remove();
        renderMarketScreen(); // Обновляем страницу маркета
      } else {
        const error = await response.json();
        alert('Ошибка: ' + (error.error || 'Не удалось создать товар'));
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения');
    }
  };
}
