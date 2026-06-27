(function () {
  const DB_NAME = "duomei_travel_archive";
  const DB_VERSION = 1;
  const BACKUPS = "backups";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BACKUPS)) {
          db.createObjectStore(BACKUPS, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function transaction(mode, callback) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUPS, mode);
      const store = tx.objectStore(BACKUPS);
      callback(store, resolve, reject);
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function backup(data, reason = "自动保存") {
    const record = { savedAt: new Date().toISOString(), reason, data };
    await transaction("readwrite", (store, resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await backups();
    for (const item of all.slice(10)) await removeBackup(item.id);
  }

  async function backups() {
    return transaction("readonly", (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.id - a.id));
      request.onerror = () => reject(request.error);
    });
  }

  async function removeBackup(id) {
    return transaction("readwrite", (store, resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function photos(data) {
    return data.journeys.flatMap((city) => {
      const cityPhotos = [];
      if (city.coverImage) cityPhotos.push({ type: "封面", city: city.title, src: city.coverImage });
      if (city.cardImage && city.cardImage !== city.coverImage) cityPhotos.push({ type: "卡片", city: city.title, src: city.cardImage });
      (city.gallery || []).forEach((photo, index) => {
        if (photo.src) cityPhotos.push({ type: `Gallery ${index + 1}`, city: city.title, src: photo.src, id: photo.id });
      });
      return cityPhotos;
    });
  }

  function bytes(value) {
    return new Blob([value || ""]).size;
  }

  function sizeLabel(value) {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function metrics(data) {
    const media = photos(data);
    const sizes = media.map((item) => bytes(item.src));
    const storageBytes = bytes(JSON.stringify(data));
    const emptySlots = data.journeys.reduce((sum, city) => sum + (city.gallery || []).filter((photo) => !photo.src && !photo.thumb).length, 0);
    const pending = media.filter((item) => item.src.startsWith("data:")).length;
    let score = 100;
    if (pending) score -= Math.min(25, pending * 3);
    if (emptySlots) score -= Math.min(10, emptySlots);
    if (storageBytes > 4 * 1024 * 1024) score -= 15;
    return {
      media,
      sizes,
      storageBytes,
      emptySlots,
      pending,
      score: Math.max(0, score),
      average: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0
    };
  }

  function refreshDashboard() {
    const data = window.ArchiveApp?.state?.data;
    if (!data) return;
    const info = metrics(data);
    document.getElementById("dashboardJourneys").textContent = data.journeys.length;
    document.getElementById("dashboardPhotos").textContent = info.media.length;
    document.getElementById("dashboardDraft").textContent = window.ArchiveCMS.loadDraft() ? "有" : "无";
    document.getElementById("healthScore").textContent = `${info.score} / 100`;
    document.getElementById("healthLabel").textContent = info.score >= 90 ? "Excellent" : info.score >= 75 ? "Good" : "需要整理";
  }

  async function renderPanel(type) {
    const panel = document.getElementById("adminPanel");
    const data = window.ArchiveApp.state.data;
    const info = metrics(data);
    panel.hidden = false;
    if (type === "media") {
      panel.innerHTML = `<header><h3>Media Manager</h3><p>${info.media.length} 张已引用图片，${info.pending} 张等待发布，${info.emptySlots} 个空槽位。</p></header>
        <div class="media-manager-grid">${info.media.map((item) => `<article><img src="${item.src}" alt=""><span>${item.city} · ${item.type}</span><small>${sizeLabel(bytes(item.src))}</small></article>`).join("") || "<p>还没有图片。</p>"}</div>`;
    }
    if (type === "repository") {
      const largest = info.sizes.length ? Math.max(...info.sizes) : 0;
      const smallest = info.sizes.length ? Math.min(...info.sizes) : 0;
      panel.innerHTML = `<header><h3>Repository & Storage</h3><p>这是浏览器可见的数据概况；GitHub 精确仓库大小仍以 GitHub 页面为准。</p></header>
        <div class="repository-grid">
          <section><span>本地 JSON</span><strong>${sizeLabel(info.storageBytes)}</strong></section>
          <section><span>图片数量</span><strong>${info.media.length}</strong></section>
          <section><span>平均图片</span><strong>${sizeLabel(info.average)}</strong></section>
          <section><span>最大 / 最小</span><strong>${sizeLabel(largest)} / ${sizeLabel(smallest)}</strong></section>
          <section><span>未发布图片</span><strong>${info.pending}</strong></section>
          <section><span>IndexedDB</span><strong>已启用</strong></section>
        </div>`;
    }
    if (type === "recovery") {
      const list = await backups();
      panel.innerHTML = `<header><h3>Recovery</h3><p>自动保留最近 10 次本地备份。</p></header>
        <div class="recovery-list">${list.map((item) => `<button type="button" data-restore-backup="${item.id}"><strong>${new Date(item.savedAt).toLocaleString()}</strong><span>${item.reason}</span></button>`).join("") || "<p>还没有恢复点。</p>"}</div>`;
    }
  }

  function openDashboard() {
    refreshDashboard();
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function closeDashboard() {
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function bind() {
    document.getElementById("adminDashboard")?.addEventListener("click", openDashboard);
    document.getElementById("dashboardClose")?.addEventListener("click", closeDashboard);
    document.getElementById("dashboardContinue")?.addEventListener("click", () => {
      closeDashboard();
      document.getElementById("editToggle")?.click();
    });
    document.addEventListener("click", async (event) => {
      const panel = event.target.closest("[data-admin-panel]");
      if (panel) await renderPanel(panel.dataset.adminPanel);
      const restore = event.target.closest("[data-restore-backup]");
      if (restore) {
        const record = (await backups()).find((item) => String(item.id) === restore.dataset.restoreBackup);
        if (!record || !confirm("恢复这个版本吗？当前未保存修改会被覆盖。")) return;
        window.ArchiveApp.state.data = window.ArchiveStore.normalize(record.data);
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
        closeDashboard();
        window.ArchiveUI?.toast("已恢复备份");
      }
    });
  }

  window.ArchiveManager = { bind, openDashboard, refreshDashboard, backup, metrics, sizeLabel };
})();
