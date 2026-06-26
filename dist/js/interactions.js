(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let stateRef;
  let observer;
  let tagFrame = 0;
  let tagItems = [];
  let lightboxIndex = 0;
  let lightboxPhotos = [];

  const cursorIcons = ["\u2708", "\u25CC", "\u2316", "\u25C7", "\u2726", "\u25EF"];

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
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

  function initCursor() {
    const cursor = $(".cursor-icon");
    const trail = $(".cursor-trail");
    if (!cursor || !trail || matchMedia("(pointer: coarse)").matches) return;

    document.body.classList.remove("custom-cursor");
    trail.innerHTML = "";

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let visible = 0;
    let iconIndex = 0;
    let lastSwitch = 0;

    document.addEventListener("pointermove", (event) => {
      tx = event.clientX;
      ty = event.clientY;
      cursor.style.opacity = "1";
    }, { passive: true });

    function frame(time) {
      x += (tx - x) * 0.42;
      y += (ty - y) * 0.42;
      visible += (0.38 - visible) * 0.1;
      cursor.style.opacity = String(visible);
      cursor.style.transform = `translate3d(${x + 18}px, ${y + 16}px, 0) scale(.72) rotate(${Math.sin(time / 1600) * 5}deg)`;
      if (time - lastSwitch > 33000) {
        iconIndex = (iconIndex + 1) % cursorIcons.length;
        cursor.textContent = cursorIcons[iconIndex];
        lastSwitch = time;
      }
      requestAnimationFrame(frame);
    }

    cursor.textContent = cursorIcons[0];
    requestAnimationFrame(frame);
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
    const list = stateRef.data.journeys.filter((city) => {
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

  function openLightbox(cityId, photoId) {
    const city = stateRef.data.journeys.find((item) => item.id === cityId || item.slug === cityId);
    if (!city) return;
    lightboxPhotos = city.gallery;
    lightboxIndex = Math.max(0, city.gallery.findIndex((photo) => photo.id === photoId));
    updateLightbox();
    $("#lightbox").classList.add("show");
    $("#lightbox").setAttribute("aria-hidden", "false");
  }

  function updateLightbox() {
    const photo = lightboxPhotos[lightboxIndex];
    if (!photo) return;
    $("#lightboxImage").src = photo.src || photo.image || photo.thumb || "";
    $("#lightboxCaption").innerHTML = photo.caption || "";
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
        $("#lightbox").classList.remove("show");
        $("#lightbox").setAttribute("aria-hidden", "true");
      }
      if (event.target.closest("[data-lightbox='prev'], [data-action='lightbox-prev']")) moveLightbox(-1);
      if (event.target.closest("[data-lightbox='next'], [data-action='lightbox-next']")) moveLightbox(1);
    });

    document.addEventListener("keydown", (event) => {
      if (!$("#lightbox").classList.contains("show")) return;
      if (event.key === "Escape") $("#lightbox").classList.remove("show");
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
    $("#searchInput")?.addEventListener("input", (event) => search(event.target.value));
    document.addEventListener("click", (event) => {
      const tag = event.target.closest("[data-filter-tag]");
      if (tag) filterTag(tag.dataset.filterTag);
    });
  }

  function init(state) {
    stateRef = state;
    window.ArchiveUI = { toast };
    initCursor();
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
