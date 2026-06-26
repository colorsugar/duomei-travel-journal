(function () {
  const KEY = "duomei_travel_archive_v2";
  const OLD_KEY = "duomei_editable_travel_journal_v1";
  let warnedQuota = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizePhoto(photo, index = 0) {
    if (typeof photo === "string") {
      return {
        id: window.ArchiveData.id("photo"),
        src: photo.startsWith("data:") ? photo : "",
        thumb: "",
        caption: index === 0 ? "照片说明可以在这里编辑。" : "",
        camera: "",
        styles: {}
      };
    }
    return {
      id: photo.id || window.ArchiveData.id("photo"),
      src: photo.src || photo.image || "",
      thumb: photo.thumb || "",
      caption: photo.caption || "",
      camera: photo.camera || "",
      styles: photo.styles || {}
    };
  }

  function normalize(data) {
    const base = clone(window.ArchiveData.initial);
    const incoming = data || {};
    const journeys = Array.isArray(incoming.journeys) ? incoming.journeys : base.journeys;
    return {
      ...base,
      ...incoming,
      site: {
        ...base.site,
        ...(incoming.site || {}),
        styles: { ...base.site.styles, ...(incoming.site?.styles || {}) }
      },
      settings: { ...base.settings, ...(incoming.settings || {}) },
      journeys: journeys.map((item) => {
        const city = {
          ...window.ArchiveData.createCity(
            item.slug || item.title || "city",
            item.title || "未命名",
            item.published || item.date || "",
            item.place || item.location || "",
            item.excerpt || item.line || "",
            item.tags || []
          ),
          ...item
        };
        city.published = item.published || item.date || city.published;
        city.updated = item.updated || new Date().toISOString().slice(0, 10);
        city.views = Number(item.views || 0);
        city.tags = Array.isArray(item.tags)
          ? item.tags
          : String(item.tags || "").split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean);
        city.gallery = Array.isArray(item.gallery)
          ? item.gallery.map(normalizePhoto)
          : Array.isArray(item.photos)
            ? item.photos.map(normalizePhoto)
            : city.gallery.map(normalizePhoto);
        city.coverThumb = item.coverThumb || "";
        city.cardThumb = item.cardThumb || "";
        city.styles = item.styles || {};
        return city;
      })
    };
  }

  function load() {
    try {
      const saved = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
      return normalize(saved ? JSON.parse(saved) : null);
    } catch {
      return normalize(null);
    }
  }

  function quotaMessage() {
    if (warnedQuota) return;
    warnedQuota = true;
    window.ArchiveUI?.toast("本地空间满了：页面可继续使用，请先导出 JSON 备份");
    setTimeout(() => { warnedQuota = false; }, 12000);
  }

  function save(data, silent = false) {
    try {
      localStorage.removeItem(OLD_KEY);
      localStorage.setItem(KEY, JSON.stringify(data));
      if (!silent) window.ArchiveUI?.toast("已保存");
      return true;
    } catch {
      quotaMessage();
      return false;
    }
  }

  function exportJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
    localStorage.removeItem(OLD_KEY);
  }

  window.ArchiveStore = { KEY, load, save, exportJson, importJson, normalize, clearSavedData };
})();
