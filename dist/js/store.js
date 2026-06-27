(function () {
  const KEY = "duomei_travel_archive_v3";
  const LEGACY_KEYS = ["duomei_travel_archive_v2", "duomei_editable_travel_journal_v1"];
  let warnedQuota = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asTags(value) {
    return Array.isArray(value)
      ? value.map((tag) => String(tag).trim()).filter(Boolean)
      : String(value || "").split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean);
  }

  function normalizePhoto(photo = {}, index = 0) {
    if (typeof photo === "string") {
      photo = { src: photo.startsWith("data:") ? photo : "" };
    }
    const caption = photo.caption || photo.description || (index === 0 ? "照片说明可以在这里编辑。" : "");
    return {
      id: photo.id || window.ArchiveData.id("photo"),
      src: photo.src || photo.image || "",
      thumb: photo.thumb || "",
      title: photo.title || "",
      caption,
      alt: photo.alt || photo.title || caption || "",
      place: photo.place || photo.location || "",
      takenAt: photo.takenAt || photo.date || "",
      camera: photo.camera || "",
      notes: photo.notes || photo.remark || "",
      width: Number(photo.width || 0),
      height: Number(photo.height || 0),
      originalBytes: Number(photo.originalBytes || 0),
      outputBytes: Number(photo.outputBytes || 0),
      uploadedAt: photo.uploadedAt || "",
      aspectMode: photo.aspectMode || "original",
      styles: {
        title: photo.styles?.title || {},
        caption: photo.styles?.caption || {},
        meta: photo.styles?.meta || {}
      }
    };
  }

  function normalizeCity(item = {}) {
    const city = {
      ...window.ArchiveData.createCity(
        item.slug || item.title || "city",
        item.title || "未命名",
        item.published || item.date || "",
        item.place || item.location || "",
        item.excerpt || item.line || "",
        asTags(item.tags)
      ),
      ...item
    };

    city.id = city.id || window.ArchiveData.id(city.slug || "journey");
    city.slug = city.slug || String(city.title || city.id).toLowerCase();
    city.published = item.published || item.date || city.published || "";
    city.updated = item.updated || new Date().toISOString().slice(0, 10);
    city.views = Number(item.views || 0);
    city.category = item.category !== undefined ? item.category : (city.category || "Travel");
    city.place = item.place || item.location || city.place || "";
    city.tags = asTags(item.tags || city.tags);
    city.coverImage = item.coverImage || "";
    city.coverThumb = item.coverThumb || "";
    city.coverCaption = item.coverCaption || item.heroCaption || "";
    city.cardImage = item.cardImage || "";
    city.cardThumb = item.cardThumb || "";
    city.theme = item.theme || null;
    city.galleryLayout = item.galleryLayout || "auto";
    city.styles = item.styles || {};
    city.gallery = Array.isArray(item.gallery)
      ? item.gallery.map(normalizePhoto)
      : Array.isArray(item.photos)
        ? item.photos.map(normalizePhoto)
        : (city.gallery || []).map(normalizePhoto);
    city.status = city.status || "public";
    return city;
  }

  function normalize(data) {
    const base = clone(window.ArchiveData.initial);
    const incoming = data || {};
    const journeys = Array.isArray(incoming.journeys) ? incoming.journeys : base.journeys;
    const site = {
      ...base.site,
      ...(incoming.site || {}),
      styles: { ...base.site.styles, ...(incoming.site?.styles || {}) }
    };
    site.journeyEyebrow = incoming.site?.journeyEyebrow ?? "Journey";
    site.journeyTitle = incoming.site?.journeyTitle ?? "慢慢翻阅";
    site.journeyDescription = incoming.site?.journeyDescription ?? "从一个地方，慢慢走到下一个地方。";
    site.hero = {
      mode: "art",
      backgroundImage: "",
      color: "#f7f3eb",
      gradient: "linear-gradient(135deg,#edf3f1 0%,#f8f4eb 52%,#e2ebe7 100%)",
      overlay: 0.12,
      blur: 0,
      glow: 0.22,
      noise: true,
      grain: true,
      height: 88,
      align: "left",
      featuredMode: "manual",
      featuredJourney: "",
      quote: "",
      quoteAuthor: "",
      ...(incoming.site?.hero || {})
    };
    site.homeSections = Array.isArray(incoming.site?.homeSections)
      ? incoming.site.homeSections.map((section, index) => ({
          id: section.id || window.ArchiveData.id("home"),
          eyebrow: section.eyebrow || "",
          title: section.title || "",
          subtitle: section.subtitle || "",
          body: section.body || "",
          buttonLabel: section.buttonLabel || "",
          buttonUrl: section.buttonUrl || "",
          layout: section.layout || "editorial",
          visible: section.visible !== false,
          order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
          styles: section.styles || {}
        }))
      : [{
          id: window.ArchiveData.id("home"),
          eyebrow: "Travel Archive",
          title: "像翻开一本安静的旅行记录册",
          subtitle: "从一个地方，慢慢走到下一个地方。",
          body: "",
          buttonLabel: "",
          buttonUrl: "",
          layout: "editorial",
          visible: true,
          order: 0,
          styles: {}
        }];
    return {
      version: 3,
      site,
      settings: {
        ...base.settings,
        theme: "auto",
        imageQuality: .82,
        defaultBackground: "art",
        animation: "smooth",
        cursor: "artistic",
        galleryLayout: "auto",
        heroStyle: "art",
        language: "zh-CN",
        ...(incoming.settings || {})
      },
      journeys: journeys.map(normalizeCity),
      notes: Array.isArray(incoming.notes) ? incoming.notes : []
    };
  }

  function readSaved() {
    const keys = [KEY, ...LEGACY_KEYS];
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) return JSON.parse(value);
    }
    return null;
  }

  function load() {
    try {
      return normalize(readSaved());
    } catch {
      return normalize(null);
    }
  }

  function quotaMessage() {
    if (warnedQuota) return;
    warnedQuota = true;
    window.ArchiveUI?.toast("本地存储空间可能满了，请先导出 JSON 备份，或减少大图数量后再试。");
    setTimeout(() => { warnedQuota = false; }, 12000);
  }

  function compactForLocalStorage(data) {
    const compact = clone(normalize(data));
    const keepPath = (value) => typeof value === "string" && !value.startsWith("data:") ? value : "";
    compact.journeys.forEach((city) => {
      city.coverImage = keepPath(city.coverImage);
      city.coverThumb = keepPath(city.coverThumb);
      city.cardImage = keepPath(city.cardImage);
      city.cardThumb = keepPath(city.cardThumb);
      city.gallery.forEach((photo) => {
        photo.src = keepPath(photo.src);
        photo.thumb = keepPath(photo.thumb);
      });
    });
    return compact;
  }

  function save(data, silent = false) {
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(KEY, JSON.stringify(compactForLocalStorage(data)));
      if (!silent) window.ArchiveUI?.toast("已保存");
      return true;
    } catch {
      quotaMessage();
      return false;
    }
  }

  function exportJson(data) {
    const blob = new Blob([JSON.stringify(normalize(data), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "duomei-travel-archive.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    return normalize(JSON.parse(await file.text()));
  }

  function clearSavedData() {
    localStorage.removeItem(KEY);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  }

  window.ArchiveStore = { KEY, load, save, exportJson, importJson, normalize, compactForLocalStorage, clearSavedData };
})();
