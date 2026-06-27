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
    const views = { home: $("#homeView"), detail: $("#detailView"), tags: $("#tagsView"), stats: $("#statsView") };
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

  function openRandom() {
    if (!state.data.journeys.length) return;
    const city = state.data.journeys[Math.floor(Math.random() * state.data.journeys.length)];
    openCity(city.slug);
  }

  function openNext() {
    if (!state.data.journeys.length) return;
    const index = Math.max(0, state.data.journeys.findIndex((city) => city.slug === state.currentSlug));
    const next = state.data.journeys[(index + 1) % state.data.journeys.length];
    openCity(next.slug);
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const view = event.target.closest("[data-view]");
      if (!view) return;
      if (view.dataset.view === "journey") showHome();
      if (view.dataset.view === "tags") showTags();
      if (view.dataset.view === "stats") showStats();
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
    openRandom,
    openNext
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
