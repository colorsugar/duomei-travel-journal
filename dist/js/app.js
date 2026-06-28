(function () {
  const $ = (selector, root = document) => root.querySelector(selector);

  const state = {
    data: window.ArchiveStore.load(),
    editMode: false,
    currentSlug: "",
    activeEditable: null,
    editingCityId: ""
  };

  function showOnly(view) {
    const views = {
      home: $("#homeView"),
      detail: $("#detailView"),
      tags: $("#tagsView"),
      stats: $("#statsView"),
      gallery: $("#galleryView"),
      thought: $("#thoughtView"),
      essay: $("#essayView")
    };
    Object.entries(views).forEach(([key, element]) => {
      element.hidden = key !== view;
      element.classList.toggle("active", key === view);
    });
  }

  function showHome() {
    state.currentSlug = "";
    showOnly("home");
    window.ArchiveImage.applyTheme();
    window.ArchiveRender.renderApp(state);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCity(slug) {
    const city = state.data.journeys.find((item) => item.slug === slug || item.id === slug);
    if (!city) return;
    state.currentSlug = city.slug;
    showOnly("detail");
    window.ArchiveRender.renderDetail(state, city.slug, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showTags() {
    state.currentSlug = "";
    showOnly("tags");
    window.ArchiveImage.applyTheme();
    window.ArchiveRender.renderTags(state);
    window.ArchiveFX.startTagCloud();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showStats() {
    state.currentSlug = "";
    showOnly("stats");
    window.ArchiveImage.applyTheme();
    window.ArchiveRender.renderStats(state);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showGallery() {
    state.currentSlug = "";
    showOnly("gallery");
    window.ArchiveImage.applyTheme();
    const root = document.getElementById("channelGalleryGrid");
    if (root) {
      const photos = state.data.journeys
        .filter((city) => city.status !== "asset")
        .flatMap((city) => {
          const cover = city.coverImage || city.cardImage
            ? [{ city, photo: { id: `cover-${city.id}`, src: city.coverImage || city.cardImage, thumb: city.coverThumb || city.cardThumb, title: city.title, caption: city.place, isCover: true } }]
            : [];
          return cover.concat((city.gallery || []).filter((photo) => photo.src || photo.thumb || photo.image).map((photo) => ({ city, photo })));
        });
      root.innerHTML = photos.length
        ? photos.map(({ city, photo }, index) => `
          <article class="gallery-item reveal">
            <div class="photo" data-city="${city.id}" data-photo="${photo.id}">
              <img src="${photo.thumb || photo.src || photo.image}" alt="${photo.alt || photo.title || city.title}">
            </div>
            <div class="photo-copy"><h3>${photo.title || city.title}</h3><p>${photo.caption || city.place || ""}</p></div>
          </article>
        `).join("")
        : `<div class="empty-channel">这里还没有内容</div>`;
    }
    requestAnimationFrame(() => window.ArchiveFX?.observe());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showChannel(name) {
    state.currentSlug = "";
    showOnly(name);
    window.ArchiveImage.applyTheme();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRandom() {
    const journeys = state.data.journeys.filter((city) => city.status !== "asset");
    if (!journeys.length) return;
    const city = journeys[Math.floor(Math.random() * journeys.length)];
    openCity(city.slug);
  }

  function openNext() {
    const journeys = state.data.journeys.filter((city) => city.status !== "asset");
    if (!journeys.length) return;
    const index = Math.max(0, journeys.findIndex((city) => city.slug === state.currentSlug));
    const next = journeys[(index + 1) % journeys.length];
    openCity(next.slug);
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const view = event.target.closest("[data-view]");
      if (!view) return;
      if (view.dataset.view === "journey") showHome();
      if (view.dataset.view === "tags") showTags();
      if (view.dataset.view === "stats") showStats();
      if (view.dataset.view === "gallery" || view.dataset.view === "photo") showGallery();
      if (view.dataset.view === "thought") showChannel("thought");
      if (view.dataset.view === "essay") showChannel("essay");
    });
  }

  async function loadPublishedArchive() {
    try {
      const bust = `v=${Date.now()}`;
      const [journeysRes, settingsRes] = await Promise.all([
        fetch(`./content/journeys.json?${bust}`, { cache: "no-store" }),
        fetch(`./content/settings.json?${bust}`, { cache: "no-store" })
      ]);
      if (!journeysRes.ok) return;
      const journeys = await journeysRes.json();
      if (!Array.isArray(journeys) || !journeys.length) return;
      const settingsPayload = settingsRes.ok ? await settingsRes.json() : {};
      state.data = window.ArchiveStore.normalize({
        site: settingsPayload.site || state.data.site,
        settings: settingsPayload.settings || state.data.settings,
        journeys
      });
      window.ArchiveRender.renderApp(state);
      if (state.currentSlug) window.ArchiveRender.renderDetail(state, state.currentSlug, false);
    } catch (error) {
      console.warn("Published archive load failed", error);
    }
  }

  function init() {
    window.ArchiveImage.bindCropper();
    window.ArchiveEditor.init(state);
    window.ArchiveManager?.bind();
    window.ArchiveFX.init(state);
    bindNavigation();
    window.ArchiveRender.renderApp(state);
    showOnly("home");
    document.body.classList.toggle("edit-on", state.editMode);
    loadPublishedArchive();
  }

  window.ArchiveApp = {
    state,
    showHome,
    openCity,
    showTags,
    showStats,
    showGallery,
    openRandom,
    openNext
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
