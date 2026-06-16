// ========== ЭКРАНЫ ВХОДА / РЕГИСТРАЦИИ ==========
let authMode = "login";
let resetToken = null;

function showAuthScreen() {
  const root = document.getElementById("appRoot");

  if (authMode === "login") {
    root.innerHTML = `
        <div class="access-screen">
          <div class="access-card">
            <h2 style="color: var(--accent);">ConChordy</h2>
            <p style="margin: 8px 0 24px;">закрытое сообщество музыкантов</p>
            
            <div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="your@email.com"></div>
            <div class="form-group"><label>Пароль</label><input type="password" id="loginPassword" placeholder="••••••••"></div>
            
            <button id="doLoginBtn" class="btn-primary" style="width:100%; margin-bottom:12px;">Войти</button>
            
            <div style="text-align: center; margin: 16px 0;">
              <a href="#" id="forgotLink" style="color: var(--text-secondary); font-size: 14px;">Забыли пароль?</a>
            </div>
            
            <div class="access-divider">───── или ─────</div>
            
            <button id="showRegisterBtn" class="btn-secondary" style="width:100%; margin-top:8px;">Зарегистрироваться</button>
            
            <div id="authError" style="margin-top:12px; font-size:13px; color:#c2410c; text-align:center;"></div>
          </div>
        </div>
      `;

    document.getElementById("doLoginBtn").onclick = async () => {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        document.getElementById("authError").innerText =
          "Заполните email и пароль";
        return;
      }

      const result = await login(email, password);
      if (result.success) {
        currentUser = result.user;
        saveAllData();
        await loadPosts();
        renderMainApp();
      } else {
        document.getElementById("authError").innerText = result.error;
      }
    };

    document.getElementById("showRegisterBtn").onclick = () => {
      authMode = "register";
      showAuthScreen();
    };

    document.getElementById("forgotLink").onclick = (e) => {
      e.preventDefault();
      authMode = "forgot";
      showAuthScreen();
    };
  } else if (authMode === "register") {
    root.innerHTML = `
        <div class="access-screen">
          <div class="access-card" style="max-width: 450px;">
            <h2 style="color: var(--accent); text-align: center;">Регистрация</h2>
            
            <div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="your@email.com"></div>
            <div class="form-group"><label>Пароль</label><input type="password" id="regPassword" placeholder="минимум 6 символов"></div>
            <div class="form-group"><label>Имя и фамилия</label><input type="text" id="regName" placeholder="Как к вам обращаться?"></div>
            <div class="form-group">
              <label> Инвайт-код <span class="accent-text">(обязательно)</span></label>
              <input type="text" id="regInviteCode" placeholder="Код от участника сообщества" class="accent-input">
            </div>
            
            <button id="doRegisterBtn" class="btn-primary" style="width:100%;">Зарегистрироваться</button>
            <button id="backToLoginBtn" class="btn-secondary" style="width:100%; margin-top:12px;">← Назад ко входу</button>
            
            <div id="regError" style="margin-top:12px; font-size:13px; color:#c2410c; text-align:center;"></div>
          </div>
        </div>
      `;

    document.getElementById("doRegisterBtn").onclick = async () => {
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      const name = document.getElementById("regName").value.trim();
      const inviteCode = document
        .getElementById("regInviteCode")
        .value.trim()
        .toUpperCase();

      if (!email || !password || !name || !inviteCode) {
        document.getElementById("regError").innerText = "Заполните все поля";
        return;
      }

      if (password.length < 6) {
        document.getElementById("regError").innerText =
          "Пароль должен быть не менее 6 символов";
        return;
      }

      const result = await register(
        email,
        password,
        name,
        inviteCode,
        "",
        "",
        "",
        "",
      );
      if (result.success) {
        currentUser = result.user;
        saveAllData();
        await loadPosts();
        renderMainApp();
      } else {
        document.getElementById("regError").innerText = result.error;
      }
    };

    document.getElementById("backToLoginBtn").onclick = () => {
      authMode = "login";
      showAuthScreen();
    };
  } else if (authMode === "forgot") {
    root.innerHTML = `<div class="access-screen"><div class="access-card"><h2>Восстановление</h2><p>Демо-режим</p><button onclick="location.reload()">Назад</button></div></div>`;
  } else if (authMode === "reset") {
    root.innerHTML = `<div class="access-screen"><div class="access-card"><h2>Сброс пароля</h2><p>Демо-режим</p><button onclick="location.reload()">Назад</button></div></div>`;
  }
}
