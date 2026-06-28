(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  let stateRef;
  let observer;
  let tagFrame = 0;
  let tagItems = [];
  let lightboxIndex = 0;
  let lightboxPhotos = [];
  const notifications = [];

  function renderNotifications() {
    const list = $("#notificationList");
    if (!list) return;
    list.innerHTML = notifications.map((item) => `
      <article class="notification-item ${item.type}">
        <strong>${esc(item.title || "通知")}</strong>
        <p>${esc(item.message)}</p>
        <time>${new Date(item.time).toLocaleTimeString()}</time>
      </article>
    `).join("");
    const badge = $("#notificationBadge");
    if (badge) {
      badge.hidden = notifications.length === 0;
      badge.textContent = String(Math.min(99, notifications.length));
    }
  }

  function notify(message, type = "normal", title = "") {
    notifications.unshift({ message: String(message || ""), type, title, time: Date.now() });
    notifications.splice(30);
    renderNotifications();
  }

  function toast(message, type = "normal") {
    const el = $("#toast");
    if (!el) return;
    const text = String(message || "");
    const inferred = /失败|错误|无法|error|failed/i.test(text) ? "error" : type;
    notify(text, inferred, inferred === "error" ? "需要处理" : "通知");
    el.textContent = message;
    el.dataset.type = inferred;
    el.classList.add("show");
    clearTimeout(toast.timer);
    if (inferred !== "error") {
      toast.timer = setTimeout(() => el.classList.remove("show"), inferred === "important" ? 12000 : 5000);
    }
  }

  function observe() {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      }, { threshold: 0.12 });
    }
    $$(".reveal").forEach((el) => observer.observe(el));
  }

  function bindCardMotion() {
    document.addEventListener("pointermove", (event) => {
      const card = event.target.closest(".journey-card");
      if (!card || matchMedia("(pointer: coarse)").matches) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--rx", `${py * -4}deg`);
      card.style.setProperty("--ry", `${px * 5}deg`);
    }, { passive: true });

    document.addEventListener("pointerleave", (event) => {
      const card = event.target.closest?.(".journey-card");
      if (!card) return;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }, true);
  }

  function updateProgress() {
    const progress = $(".reading-progress span");
    if (!progress) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progress.style.width = `${(window.scrollY / max) * 100}%`;
  }

  function fuzzy(text, query) {
    let index = 0;
    for (const char of text) if (char === query[index]) index += 1;
    return index === query.length;
  }

  function search(value) {
    const box = $("#searchResults");
    if (!box || !stateRef) return;
    const q = value.trim().toLowerCase();
    if (!q) {
      box.innerHTML = "";
      window.ArchiveRender.renderJourney(stateRef, stateRef.data.journeys);
      return;
    }
    const list = stateRef.data.journeys.filter((city) => city.status !== "asset").filter((city) => {
      const hay = [
        city.title,
        city.place,
        city.published,
        city.category,
        city.excerpt,
        city.bodyTop,
        city.bodyBottom,
        ...(city.tags || [])
      ].join(" ").toLowerCase();
      return hay.includes(q) || fuzzy(city.title.toLowerCase(), q);
    });
    box.innerHTML = `找到 ${list.length} 个相关旅程`;
    window.ArchiveRender.renderJourney(stateRef, list);
  }

  function searchableText(city) {
    return [
      city.title,
      city.place,
      city.country,
      city.city,
      city.published,
      String(city.published || "").match(/\d{4}/)?.[0],
      city.category,
      city.excerpt,
      city.bodyTop,
      city.bodyBottom,
      ...(city.tags || []),
      ...(city.gallery || []).flatMap((photo) => [photo.title, photo.caption, photo.place, photo.takenAt, photo.camera, photo.notes])
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function searchStable(value) {
    const box = $("#searchResults");
    if (!box || !stateRef) return;
    const q = String(value || "").trim().toLowerCase();
    if (!q) {
      box.innerHTML = "";
      document.body.classList.remove("search-mode");
      window.ArchiveRender.renderJourney(stateRef, stateRef.data.journeys);
      return;
    }
    document.body.classList.add("search-mode");
    const list = stateRef.data.journeys
      .filter((city) => city.status !== "asset")
      .filter((city) => searchableText(city).includes(q) || fuzzy(String(city.title || "").toLowerCase(), q));
    box.innerHTML = list.length
      ? `<strong>找到 ${list.length} 个旅程</strong>`
      : `<div class="empty-search"><strong>没有找到相关内容</strong><button type="button" data-action="clear-search">清空搜索</button></div>`;
    window.ArchiveRender.renderJourney(stateRef, list);
    requestAnimationFrame(() => $("#journeyGrid")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const debouncedSearch = (() => {
    let timer = 0;
    return (value) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => searchStable(value), 300);
    };
  })();

  function openLightbox(cityId, photoId) {
    const city = stateRef.data.journeys.find((item) => item.id === cityId || item.slug === cityId);
    if (!city) {
      window.ArchiveUI?.toast("没有找到这个 Journey");
      return;
    }
    const cover = city.coverImage || city.cardImage
      ? [{
          id: `cover-${city.id}`,
          src: city.coverImage || city.cardImage,
          thumb: city.coverThumb || city.cardThumb,
          title: city.title,
          caption: city.place,
          place: city.place,
          takenAt: city.published,
          alt: city.title
        }]
      : [];
    lightboxPhotos = cover.concat((city.gallery || []).filter((photo) => photo.src || photo.image || photo.thumb));
    lightboxIndex = lightboxPhotos.findIndex((photo) => photo.id === photoId);
    if (!lightboxPhotos.length || lightboxIndex < 0) {
      window.ArchiveUI?.toast("这张照片不存在或尚未上传");
      return;
    }
    updateLightbox();
    $("#lightbox").classList.add("show");
    $("#lightbox").setAttribute("aria-hidden", "false");
  }

  function updateLightbox() {
    const photo = lightboxPhotos[lightboxIndex];
    const src = photo?.src || photo?.image || photo?.thumb || "";
    if (!photo || !src) {
      closeLightbox();
      window.ArchiveUI?.toast("照片不存在，已返回 Journey");
      return;
    }
    const image = $("#lightboxImage");
    $("#lightbox").classList.add("is-loading");
    $("#lightboxError").hidden = true;
    image.removeAttribute("src");
    image.src = src;
    image.alt = photo.alt || photo.title || photo.caption || "Travel photo";
    $("#lightboxCounter").textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
    $("#lightboxCaption").innerHTML = [
      photo.title ? `<strong>${esc(photo.title)}</strong>` : "",
      esc(photo.caption || ""),
      esc([photo.place, photo.takenAt, photo.camera].filter(Boolean).join(" · "))
    ].filter(Boolean).join("<br>");
  }

  function closeLightbox() {
    $("#lightbox").classList.remove("show", "is-loading", "has-error");
    $("#lightbox").setAttribute("aria-hidden", "true");
    $("#lightboxImage").removeAttribute("src");
  }

  function moveLightbox(step) {
    if (!lightboxPhotos.length) return;
    lightboxIndex = (lightboxIndex + step + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
  }

  function bindLightbox() {
    document.addEventListener("click", (event) => {
      const item = event.target.closest(".gallery-item .photo");
      if (item && !event.target.closest(".edit-controls, .image-tools")) {
        openLightbox(item.dataset.city, item.dataset.photo);
      }
      const film = event.target.closest("[data-lightbox-photo]");
      if (film && stateRef.currentSlug) {
        const city = stateRef.data.journeys.find((entry) => entry.slug === stateRef.currentSlug);
        if (city) openLightbox(city.id, film.dataset.lightboxPhoto);
      }
      if (event.target.closest("[data-lightbox='close'], [data-action='lightbox-close']")) {
        closeLightbox();
      }
      if (event.target.id === "lightbox") {
        closeLightbox();
      }
      if (event.target.closest("[data-lightbox='prev'], [data-action='lightbox-prev']")) moveLightbox(-1);
      if (event.target.closest("[data-lightbox='next'], [data-action='lightbox-next']")) moveLightbox(1);
    });

    document.addEventListener("keydown", (event) => {
      if (!$("#lightbox").classList.contains("show")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    });

    let startX = 0;
    $("#lightbox").addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
    }, { passive: true });
    $("#lightbox").addEventListener("touchend", (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 48) moveLightbox(dx > 0 ? -1 : 1);
    });
    $("#lightboxImage").addEventListener("load", () => {
      $("#lightbox").classList.remove("is-loading", "has-error");
      $("#lightboxError").hidden = true;
    });
    $("#lightboxImage").addEventListener("error", () => {
      $("#lightbox").classList.remove("is-loading");
      $("#lightbox").classList.add("has-error");
      $("#lightboxError").hidden = false;
      window.ArchiveUI?.toast("照片加载失败，正在返回 Journey");
      window.setTimeout(closeLightbox, 2200);
    });
  }

  function startTagCloud() {
    cancelAnimationFrame(tagFrame);
    const area = $("#tagCloud");
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const bubbles = $$(".tag-bubble", area);
    tagItems = bubbles.map((el, index) => {
      const size = Number(el.dataset.size || 48);
      const x = (index * 83) % Math.max(80, rect.width - size);
      const y = (index * 59) % Math.max(80, rect.height - size);
      return {
        el,
        x,
        y,
        vx: (index % 2 ? 0.18 : -0.16) * (0.7 + (index % 4) / 8),
        vy: (index % 3 ? 0.14 : -0.17) * (0.7 + (index % 5) / 10),
        r: size / 2
      };
    });
    animateTags(area);
  }

  function animateTags(area) {
    const rect = area.getBoundingClientRect();
    for (const item of tagItems) {
      item.x += item.vx;
      item.y += item.vy;
      if (item.x < 0 || item.x + item.r * 2 > rect.width) item.vx *= -1;
      if (item.y < 0 || item.y + item.r * 2 > rect.height) item.vy *= -1;
      item.x = Math.max(0, Math.min(rect.width - item.r * 2, item.x));
      item.y = Math.max(0, Math.min(rect.height - item.r * 2, item.y));
    }

    for (let i = 0; i < tagItems.length; i += 1) {
      for (let j = i + 1; j < tagItems.length; j += 1) {
        const a = tagItems[i];
        const b = tagItems[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const min = a.r + b.r + 12;
        if (distance < min) {
          const push = (min - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          [a.vx, b.vx] = [b.vx, a.vx];
          [a.vy, b.vy] = [b.vy, a.vy];
        }
      }
    }

    tagItems.forEach((item) => {
      item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
    });
    tagFrame = requestAnimationFrame(() => animateTags(area));
  }

  function filterTag(tag) {
    const results = $("#tagResults");
    if (!results || !stateRef) return;
    const list = stateRef.data.journeys.filter((city) => city.tags.includes(tag));
    results.innerHTML = `
      <p class="section-kicker">Tag: ${tag}</p>
      <div class="result-list">
        ${list.map((city) => `<button data-open-city="${city.slug}">${city.title}<span>${city.place}</span></button>`).join("")}
      </div>
    `;
  }

  function bindFilters() {
    $("#searchInput")?.addEventListener("input", (event) => debouncedSearch(event.target.value));
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='focus-search']")) {
        const input = $("#searchInput");
        if (input) {
          window.ArchiveApp?.showHome();
          setTimeout(() => {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            input.focus();
          }, 150);
        }
      }
      if (event.target.closest("[data-action='clear-search']")) {
        const input = $("#searchInput");
        if (input) input.value = "";
        searchStable("");
      }
      if (event.target.closest("[data-action='toggle-language']")) {
        const menu = $("#languageMenu");
        if (menu) menu.hidden = !menu.hidden;
        return;
      }
      const lang = event.target.closest("[data-language]");
      if (lang) {
        document.documentElement.lang = lang.dataset.language;
        localStorage.setItem("duomei_public_language", lang.dataset.language);
        $("#languageMenu").hidden = true;
        window.ArchiveUI?.toast(`语言已切换：${lang.textContent.trim()}`);
      }
      if (event.target.closest("#toast")) {
        const center = $("#notificationCenter");
        if (center) {
          renderNotifications();
          center.hidden = false;
          center.classList.add("show");
        }
        $("#toast")?.classList.remove("show");
      }
      if (event.target.closest("#notificationBell")) {
        const center = $("#notificationCenter");
        if (center) {
          renderNotifications();
          center.hidden = false;
          center.classList.add("show");
        }
        return;
      }
      if (event.target.closest("#notificationClose")) {
        const center = $("#notificationCenter");
        if (center) {
          center.hidden = true;
          center.classList.remove("show");
        }
      }
      const tag = event.target.closest("[data-filter-tag]");
      if (tag) filterTag(tag.dataset.filterTag);
    });
    document.addEventListener("click", (event) => {
      const languageMenu = $("#languageMenu");
      if (languageMenu && !languageMenu.hidden && !event.target.closest(".language-switch")) {
        languageMenu.hidden = true;
      }
      const center = $("#notificationCenter");
      if (center && !center.hidden && !event.target.closest("#notificationCenter, #notificationBell, #toast")) {
        center.hidden = true;
        center.classList.remove("show");
      }
    });
  }

  function init(state) {
    stateRef = state;
    window.ArchiveUI = { toast, notify };
    bindCardMotion();
    bindLightbox();
    bindFilters();
    observe();
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", () => {
      if (!$("#tagsView").hidden) startTagCloud();
    });
  }

  window.ArchiveFX = {
    init,
    observe,
    startTagCloud,
    filterTag,
    openLightbox
  };
})();
