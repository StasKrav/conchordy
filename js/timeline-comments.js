// ========== МОДУЛЬ ТАЙМКОД-КОММЕНТАРИЕВ (с поддержкой диапазонов) ==========
class TimelineComments {
  constructor(postId, audioUrl, containerElement) {
    this.postId = postId;
    this.audioUrl = audioUrl;
    this.container = containerElement;
    this.wavesurfer = null;
    this.comments = [];
    this.currentTime = 0;

    // Для выделения диапазона
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartTime = 0;
    this.rangeSelection = null;

    // Сохраняем экземпляр в DOM
    containerElement.__timelineInstance = this;

    // Запускаем инициализацию
    this.init();
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds === undefined || seconds === null)
      return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${date.getDate()} ${date.toLocaleString("ru", { month: "short" })}`;
  }

  async loadComments() {
    try {
      const url = `${API_BASE}/timeline-comments/${this.postId}${currentUser ? `?userId=${currentUser.id}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        this.comments = await response.json();
        console.log(
          `📝 Загружено ${this.comments.length} комментариев для поста ${this.postId}`,
        );

        // Обновляем список комментариев
        const listContainer = this.container.querySelector(
          ".timeline-comments-list",
        );
        if (listContainer) {
          this.renderCommentsList(listContainer);
        }
      } else {
        this.comments = [];
      }
    } catch (e) {
      console.error("Ошибка загрузки комментариев:", e);
      this.comments = [];
    }
  }

  async addComment(startTime, endTime, text) {
    if (!currentUser) {
      alert("Войдите в аккаунт, чтобы комментировать");
      return false;
    }
    if (!text.trim()) return false;

    try {
      const response = await fetch(`${API_BASE}/timeline-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: this.postId,
          user_id: currentUser.id,
          start_time: startTime,
          end_time: endTime || null,
          comment_text: text.trim(),
        }),
      });

      if (response.ok) {
        const newComment = await response.json();
        this.comments.push(newComment);
        const listContainer = this.container.querySelector(
          ".timeline-comments-list",
        );
        if (listContainer) this.renderCommentsList(listContainer);
        return true;
      } else {
        const error = await response.json();
        alert("Ошибка: " + (error.error || "Не удалось добавить комментарий"));
      }
    } catch (e) {
      console.error("Ошибка добавления комментария:", e);
      alert("Ошибка соединения");
    }
    return false;
  }

  async likeComment(commentId) {
    if (!currentUser) {
      alert("Войдите в аккаунт");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/comment-likes/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      if (response.ok) {
        await this.loadComments();
      }
    } catch (e) {
      console.error("Ошибка лайка:", e);
    }
  }

  async deleteComment(commentId) {
    if (!currentUser) return;
    if (!confirm("Удалить комментарий?")) return;

    try {
      const response = await fetch(
        `${API_BASE}/timeline-comments/${commentId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: currentUser.id }),
        },
      );

      if (response.ok) {
        await this.loadComments();
      } else {
        const error = await response.json();
        alert("Ошибка: " + (error.error || "Не удалось удалить"));
      }
    } catch (e) {
      console.error("Ошибка удаления:", e);
    }
  }

  showCommentModal(startTime, endTime, isRange) {
    return new Promise((resolve) => {
      // Создаём оверлей
      const overlay = document.createElement("div");
      overlay.className = "comment-modal-overlay";

      const timeDisplay = isRange
        ? `${this.formatTime(startTime)} → ${this.formatTime(endTime)}`
        : this.formatTime(startTime);

      const modalHtml = `
          <div class="comment-modal">
            <div class="comment-modal-header">
              <h3>${isRange ? "Комментарий к диапазону" : "Комментарий к моменту"}</h3>
              <button class="comment-modal-close">&times;</button>
            </div>
            ${
              isRange
                ? `
              <div class="comment-modal-range-badge">Выделено: ${timeDisplay}
              </div>
            `
                : `
              <div class="comment-modal-time">
                <span>${timeDisplay}</span>
              </div>
            `
            }
            <div class="comment-modal-body">
              <textarea class="comment-modal-textarea" placeholder="Напишите свой комментарий..."></textarea>
            </div>
            <div class="comment-modal-footer">
              <button class="comment-modal-cancel">Отмена</button>
              <button class="comment-modal-submit">Отправить</button>
            </div>
          </div>
        `;

      overlay.innerHTML = modalHtml;
      document.body.appendChild(overlay);

      const textarea = overlay.querySelector(".comment-modal-textarea");
      const closeBtn = overlay.querySelector(".comment-modal-close");
      const cancelBtn = overlay.querySelector(".comment-modal-cancel");
      const submitBtn = overlay.querySelector(".comment-modal-submit");

      // Фокус на текстовое поле
      setTimeout(() => textarea.focus(), 100);

      const closeModal = () => {
        overlay.remove();
        resolve(null);
      };

      const submit = () => {
        const text = textarea.value.trim();
        if (text) {
          overlay.remove();
          resolve(text);
        } else {
          textarea.style.borderColor = "#c2410c";
          textarea.placeholder = "Пожалуйста, напишите комментарий";
        }
      };

      closeBtn.addEventListener("click", closeModal);
      cancelBtn.addEventListener("click", closeModal);
      submitBtn.addEventListener("click", submit);

      // Закрытие по клику на оверлей
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });

      // Enter + Ctrl/Cmd для отправки
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          submit();
        }
      });
    });
  }

  seekToTime(seconds) {
    if (this.wavesurfer) {
      const duration = this.wavesurfer.getDuration();
      if (duration > 0) {
        this.wavesurfer.seekTo(seconds / duration);
        this.wavesurfer.play();
      }
    }
  }

  playRange(startTime, endTime) {
    if (this.wavesurfer) {
      this.wavesurfer.seekTo(startTime / this.wavesurfer.getDuration());
      this.wavesurfer.play();

      const stopAtEnd = () => {
        if (this.wavesurfer.getCurrentTime() >= endTime) {
          this.wavesurfer.pause();
          this.wavesurfer.un("audioprocess", stopAtEnd);
        }
      };
      this.wavesurfer.on("audioprocess", stopAtEnd);
    }
  }

  updateTimeBadge() {
    const badge = this.container.querySelector(".current-time-value");
    if (badge) badge.textContent = this.formatTime(this.currentTime);
  }

  updatePlayButtonIcon() {
    const playBtn = this.container.querySelector(".waveform-play-btn");
    if (playBtn && this.wavesurfer) {
      const icon = playBtn.querySelector("i");
      if (icon) {
        icon.className = this.wavesurfer.isPlaying()
          ? "fa-solid fa-pause"
          : "fa-solid fa-play";
      }
    }
  }

  // Остановить и перемотать в начало
  stopAndReset() {
    if (this.wavesurfer) {
      this.wavesurfer.stop();
      this.currentTime = 0;
      this.updateTimeBadge();
      this.updatePlayButtonIcon();
    }
  }

  // Перемотка назад на X секунд
  // Перемотка назад на X секунд
  rewind(seconds = 10) {
    if (this.wavesurfer) {
      const newTime = Math.max(0, this.wavesurfer.getCurrentTime() - seconds);
      this.wavesurfer.seekTo(newTime / this.wavesurfer.getDuration());
      this.updateTimeBadge();
    }
  }

  // Перемотка на 1 секунду назад
  rewind1() {
    this.rewind(1);
  }

  // Перемотка вперёд на X секунд
  forward(seconds = 10) {
    if (this.wavesurfer) {
      const duration = this.wavesurfer.getDuration();
      const newTime = Math.min(
        duration,
        this.wavesurfer.getCurrentTime() + seconds,
      );
      this.wavesurfer.seekTo(newTime / duration);
      this.updateTimeBadge();
    }
  }

  // Перемотка на 1 секунду вперёд
  forward1() {
    this.forward(1);
  }

  renderCommentsList(listContainer) {
    if (!listContainer) return;

    // Проверяем, не скрыл ли пользователь подсказку навсегда
    const hintDismissed = localStorage.getItem(
      "chiuso_timeline_hint_dismissed",
    );

    // Если есть комментарии — показываем их
    if (this.comments.length > 0) {
      const sortedComments = [...this.comments].sort(
        (a, b) => a.start_time - b.start_time,
      );

      listContainer.innerHTML = sortedComments
        .map((comment) => {
          const isLiked = comment.is_liked === 1 || comment.is_liked === true;
          const isAuthor = currentUser && comment.user_id === currentUser.id;

          const timeDisplay =
            comment.end_time && comment.end_time !== comment.start_time
              ? `${this.formatTime(comment.start_time)} → ${this.formatTime(comment.end_time)}`
              : this.formatTime(comment.start_time);

          const rangeClass =
            comment.end_time && comment.end_time !== comment.start_time
              ? "range-comment"
              : "point-comment";

          return `
            <div class="timeline-comment ${rangeClass}" data-start-time="${comment.start_time}" data-end-time="${comment.end_time || ""}">
              <div class="comment-timestamp">${timeDisplay}</div>
              <div class="comment-content">
                <div class="comment-author">
                  ${escapeHtml(comment.author_name || "Участник")}
                  <span>${this.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
                <div class="comment-actions">
                  <button class="comment-like-btn ${isLiked ? "liked" : ""}" data-comment-id="${comment.id}">
                    <i class="fa-${isLiked ? "solid" : "regular"} fa-heart"></i> ${comment.likes_count || 0}
                  </button>
                  ${
                    isAuthor
                      ? `
                    <button class="comment-delete-btn-global" data-comment-id="${comment.id}">
                      <i class="fa-regular fa-trash-can"></i> Удалить
                    </button>
                  `
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      // При клике на комментарий — перематываем трек
      listContainer.querySelectorAll(".timeline-comment").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (
            e.target.closest(".comment-like-btn") ||
            e.target.closest(".comment-delete-btn-global")
          )
            return;
          const startTime = parseFloat(el.getAttribute("data-start-time"));
          const endTime = el.getAttribute("data-end-time");

          if (endTime && parseFloat(endTime) !== startTime) {
            this.playRange(startTime, parseFloat(endTime));
          } else {
            this.seekToTime(startTime);
          }
        });
      });

      // Лайки
      listContainer.querySelectorAll(".comment-like-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const commentId = btn.getAttribute("data-comment-id");
          await this.likeComment(commentId);
        });
      });

      // Удаление
      listContainer
        .querySelectorAll(".comment-delete-btn-global")
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const commentId = btn.getAttribute("data-comment-id");
            await this.deleteComment(commentId);
          });
        });

      return;
    }

    // Если комментариев нет и подсказка не скрыта навсегда — показываем её
    if (!hintDismissed) {
      listContainer.innerHTML = `
          <div class="timeline-empty">
            <svg class="timeline-empty-icon" width="40" height="40" viewBox="0 0 242 242" xmlns="http://www.w3.org/2000/svg">
              <circle cx="121" cy="121" r="32" stroke="currentColor" stroke-width="10" fill="none"/>
              <path d="M121,89 L121,25" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M121,153 L121,217" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M153,121 L217,121" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M89,121 L25,121" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M153,89 L185,57" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M89,89 L57,57" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M89,153 L57,185" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
              <path d="M153,153 L185,185" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
            </svg>
            <div class="timeline-empty-title">Как это работает</div>
            <div class="timeline-empty-steps">
              <div class="step-item">
                <svg width="30" height="20" viewBox="0 0 146 146" xmlns="http://www.w3.org/2000/svg">
                  <path d="M25,25 L25,89" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M25,25 L89,25" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M25,25 L121,121" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                </svg>
                <span><strong>Нажми на паузу при воспроизведении или Кликни на волну</strong> — оставь комментарий к этому моменту</span>
              </div>
              <div class="step-item">
                <svg width="30" height="20" viewBox="0 0 178 114" xmlns="http://www.w3.org/2000/svg">
                  <path d="M25,57 L153,57" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M121,25 L153,57" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M153,57 L121,89" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M57,89 L25,57" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M25,57 L57,25" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                </svg>
                <span><strong>Зажми и потяни</strong> — выдели диапазон для комментария</span>
              </div>
              <div class="step-item">
                <svg width="30" height="20" viewBox="0 0 146 178" xmlns="http://www.w3.org/2000/svg">
                  <path d="M25,25 L121,89" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M121,89 L25,153" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                  <path d="M25,153 L25,25" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
                </svg>
                <span><strong>Кликни на комментарий</strong> — трек перемотается на это место</span>
              </div>
            </div>
            <button class="timeline-hint-dismiss-btn" id="dismissHintBtn_${this.postId}">
              <i class="fa-regular fa-eye-slash"></i> Больше не показывать
            </button>
          </div>
        `;

      // Добавляем обработчик для кнопки скрытия
      const dismissBtn = listContainer.querySelector(
        `#dismissHintBtn_${this.postId}`,
      );
      if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
          localStorage.setItem("chiuso_timeline_hint_dismissed", "true");
          listContainer.innerHTML =
            '<div class="timeline-empty" style="padding: 16px; font-size: 12px;">Подсказка скрыта. Комментарии появятся здесь</div>';
        });
      }
    } else {
      // Подсказка навсегда скрыта
      listContainer.innerHTML =
        '<div class="timeline-empty" style="padding: 16px; font-size: 12px; color: var(--text-secondary);">Пока нет комментариев. Будьте первым!</div>';
    }
  }

  initWaveSurfer() {
    const waveformDiv = this.container.querySelector("#waveform");
    if (!waveformDiv) {
      console.error("Waveform контейнер не найден");
      return;
    }

    if (typeof WaveSurfer === "undefined") {
      console.error("WaveSurfer не загружен");
      return;
    }

    this.wavesurfer = WaveSurfer.create({
      container: waveformDiv,
      waveColor: "#d4cdc4",
      progressColor: "#d96c4a",
      cursorColor: "#d96c4a",
      barWidth: 2,
      barGap: 1,
      height: 80,
      normalize: true,
      responsive: true,
    });

    this.wavesurfer.load(this.audioUrl);

    this.wavesurfer.on("ready", () => {
      const duration = this.wavesurfer.getDuration();
      const totalSpan = this.container.querySelector(".total-time-value");
      if (totalSpan) totalSpan.textContent = `/ ${this.formatTime(duration)}`;
      console.log("🎵 Waveform готов");
    });

    this.wavesurfer.on("audioprocess", () => {
      this.currentTime = this.wavesurfer.getCurrentTime();
      this.updateTimeBadge();
      this.updatePlayButtonIcon();
    });

    this.wavesurfer.on("finish", () => {
      this.updatePlayButtonIcon();
    });

    // ========== ОБРАБОТЧИКИ ДЛЯ ВЫДЕЛЕНИЯ ДИАПАЗОНА ==========

    waveformDiv.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!this.wavesurfer) return;

      e.preventDefault();

      this.isDragging = true;
      const rect = waveformDiv.getBoundingClientRect();
      this.dragStartX = e.clientX;
      const percentage = Math.max(
        0,
        Math.min(1, (this.dragStartX - rect.left) / rect.width),
      );
      this.dragStartTime = percentage * this.wavesurfer.getDuration();

      this.rangeSelection = document.createElement("div");
      this.rangeSelection.className = "waveform-range-selection";
      this.rangeSelection.style.left = `${this.dragStartX - rect.left}px`;
      this.rangeSelection.style.width = "0px";
      waveformDiv.appendChild(this.rangeSelection);

      document.body.style.userSelect = "none";
    });

    waveformDiv.addEventListener("mousemove", (e) => {
      if (!this.isDragging || !this.rangeSelection) return;

      const rect = waveformDiv.getBoundingClientRect();
      const currentX = e.clientX;
      const startXRelative = this.dragStartX - rect.left;
      const currentXRelative = currentX - rect.left;
      let width = currentXRelative - startXRelative;

      if (width > 0) {
        this.rangeSelection.style.left = `${startXRelative}px`;
        this.rangeSelection.style.width = `${width}px`;
      } else {
        this.rangeSelection.style.left = `${currentXRelative}px`;
        this.rangeSelection.style.width = `${-width}px`;
      }
    });

    waveformDiv.addEventListener("mouseup", async (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (this.rangeSelection) {
        this.rangeSelection.remove();
        this.rangeSelection = null;
      }

      document.body.style.userSelect = "";

      const rect = waveformDiv.getBoundingClientRect();
      const endX = e.clientX;
      const startPercentage = Math.max(
        0,
        Math.min(1, (this.dragStartX - rect.left) / rect.width),
      );
      const endPercentage = Math.max(
        0,
        Math.min(1, (endX - rect.left) / rect.width),
      );

      const startTime = Math.min(
        this.dragStartTime,
        endPercentage * this.wavesurfer.getDuration(),
      );
      const endTime = Math.max(
        this.dragStartTime,
        endPercentage * this.wavesurfer.getDuration(),
      );
      const rangeDuration = endTime - startTime;

      // Если диапазон меньше 0.1 секунды — это точка
      if (rangeDuration < 0.1) {
        const comment = await this.showCommentModal(startTime, null, false);
        if (comment) await this.addComment(startTime, null, comment);
      } else {
        const comment = await this.showCommentModal(startTime, endTime, true);
        if (comment) await this.addComment(startTime, endTime, comment);
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.rangeSelection) {
          this.rangeSelection.remove();
          this.rangeSelection = null;
        }
        document.body.style.userSelect = "";
      }
    });

    // Тултип при наведении
    waveformDiv.addEventListener("mousemove", (e) => {
      if (this.isDragging) return;
      if (!this.wavesurfer || !this.wavesurfer.getDuration()) return;

      const rect = waveformDiv.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const seconds = percentage * this.wavesurfer.getDuration();

      let tooltip = waveformDiv.querySelector(".waveform-tooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "waveform-tooltip";
        waveformDiv.style.position = "relative";
        waveformDiv.appendChild(tooltip);
      }
      tooltip.textContent = this.formatTime(seconds);
      tooltip.style.left = `${clickX}px`;
      tooltip.style.top = "-20px";
    });

    waveformDiv.addEventListener("mouseleave", () => {
      const tooltip = waveformDiv.querySelector(".waveform-tooltip");
      if (tooltip) tooltip.remove();
    });
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
        <div class="timeline-container">
          <div class="waveform-controls">
            <div class="waveform-group">
              <button class="waveform-rewind-1-btn" title="Назад на 1 секунду">
                <i class="fa-solid fa-backward-step"></i>
                <span class="rewind-1-label">1</span>
              </button>
              <button class="waveform-rewind-10-btn" title="Назад на 10 секунд">
                <i class="fa-solid fa-backward-step"></i>
                <span class="rewind-10-label">10</span>
              </button>
            </div>
            
            <button class="waveform-play-btn" title="Play / Pause">
              <i class="fa-solid fa-play"></i>
            </button>
            
            <button class="waveform-stop-btn" title="Остановить и в начало">
              <i class="fa-solid fa-stop"></i>
            </button>
            
            <div class="waveform-group">
              <button class="waveform-forward-10-btn" title="Вперёд на 10 секунд">
                <i class="fa-solid fa-forward-step"></i>
                <span class="forward-10-label">10</span>
              </button>
              <button class="waveform-forward-1-btn" title="Вперёд на 1 секунду">
                <i class="fa-solid fa-forward-step"></i>
                <span class="forward-1-label">1</span>
              </button>
            </div>
            
            <div class="current-time-badge">
              <span class="current-time-value">0:00</span>
              <span class="total-time-value">/ 0:00</span>
            </div>
          </div>
          <div class="waveform-container">
            <div id="waveform"></div>
          </div>
          <div class="timeline-comments-list"></div>
          <div class="add-comment-form">
            <input type="text" class="add-comment-input" placeholder="Напишите комментарий к текущему моменту...">
            <button class="add-comment-submit">Оставить</button>
          </div>
        </div>
      `;

    // Добавляем обработчик кнопки Play/Pause
    const playBtn = this.container.querySelector(".waveform-play-btn");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (this.wavesurfer) {
          this.wavesurfer.playPause();
          this.updatePlayButtonIcon();
        }
      });
    }

    // Добавляем обработчики для кнопок перемотки
    const rewind1Btn = this.container.querySelector(".waveform-rewind-1-btn");
    const rewind10Btn = this.container.querySelector(".waveform-rewind-10-btn");
    const forward10Btn = this.container.querySelector(
      ".waveform-forward-10-btn",
    );
    const forward1Btn = this.container.querySelector(".waveform-forward-1-btn");
    const stopBtn = this.container.querySelector(".waveform-stop-btn");

    if (rewind1Btn) {
      rewind1Btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rewind1();
      });
    }

    if (rewind10Btn) {
      rewind10Btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rewind(10);
      });
    }

    if (forward10Btn) {
      forward10Btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.forward(10);
      });
    }

    if (forward1Btn) {
      forward1Btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.forward1();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.stopAndReset();
      });
    }

    const input = this.container.querySelector(".add-comment-input");
    const submitBtn = this.container.querySelector(".add-comment-submit");

    const addAtCurrentTime = async () => {
      const text = await this.showCommentModal(this.currentTime, null, false);
      if (text) {
        const success = await this.addComment(this.currentTime, null, text);
        if (success && input) input.value = "";
      }
    };

    submitBtn.addEventListener("click", addAtCurrentTime);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addAtCurrentTime();
    });

    // Инициализируем WaveSurfer
    this.initWaveSurfer();

    // Рендерим список комментариев (с подсказкой, если нужно)
    const listContainer = this.container.querySelector(
      ".timeline-comments-list",
    );
    if (listContainer) {
      this.renderCommentsList(listContainer);
    }
  }

  async init() {
    await this.loadComments();
    this.render();
  }

  destroy() {
    if (this.wavesurfer) {
      try {
        this.wavesurfer.destroy();
      } catch (e) {}
      this.wavesurfer = null;
    }
  }
}
