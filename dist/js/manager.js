(function () {
  const DB_NAME = "duomei_travel_archive";
  const DB_VERSION = 1;
  const BACKUPS = "backups";
  const ICONS = {
    house: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v13h16V8M10 12h4"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    "panel-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M14 9l-3 3 3 3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
  };

  function icon(name) {
    return `<svg class="studio-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.activity}</svg>`;
  }

  function renderIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((node) => {
      if (!node.querySelector(".studio-icon")) node.insertAdjacentHTML("afterbegin", icon(node.dataset.icon));
    });
  }

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
      if (city.coverImage) cityPhotos.push({
        type: city.cardImage === city.coverImage ? "Cover · Card" : "Cover",
        city: city.title,
        cityId: city.id,
        slug: city.slug,
        src: city.coverImage,
        references: city.cardImage === city.coverImage ? 2 : 1,
        ...(city.coverMeta || {})
      });
      if (city.cardImage && city.cardImage !== city.coverImage) cityPhotos.push({
        type: "Card",
        city: city.title,
        cityId: city.id,
        slug: city.slug,
        src: city.cardImage,
        references: 1,
        ...(city.cardMeta || {})
      });
      (city.gallery || []).forEach((photo, index) => {
        if (photo.src) cityPhotos.push({ type: `Gallery ${index + 1}`, city: city.title, cityId: city.id, slug: city.slug, src: photo.src, id: photo.id, references: 1, ...photo });
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

  async function mediaByteSize(item) {
    if (!item?.src) return 0;
    if (item.src.startsWith("data:")) return bytes(item.src);
    try {
      const response = await fetch(item.src, { method: "HEAD", cache: "no-store" });
      return Number(response.headers.get("content-length")) || bytes(item.src);
    } catch {
      return bytes(item.src);
    }
  }

  function animateNumber(element, target, suffix = "") {
    if (!element) return;
    const start = performance.now();
    const duration = 850;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function latestBackup() {
    try {
      return (await backups())[0] || null;
    } catch {
      return null;
    }
  }

  function welcomeCopy() {
    const hour = new Date().getHours();
    if (hour < 6) return ["夜深了，多美。", "慢慢记录，也记得好好休息。"];
    if (hour < 12) return ["早上好，多美。", "新的故事，从这里开始。"];
    if (hour < 18) return ["下午好，多美。", "今天也继续记录旅程吧。"];
    return ["欢迎回来，多美。", "愿今天也留下值得珍藏的一页。"];
  }

  function firstPublishDate(journeys) {
    const dates = journeys.map((city) => {
      const raw = String(city.published || "").replace(/\./g, "-");
      const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
      const value = new Date(normalized).getTime();
      return Number.isFinite(value) ? value : null;
    }).filter(Boolean);
    return dates.length ? Math.min(...dates) : Date.now();
  }

  function relativeTime(value) {
    if (!value) return "暂无";
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return "刚刚";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;
    return new Date(value).toLocaleDateString();
  }

  async function refreshDashboard() {
    const data = window.ArchiveApp?.state?.data;
    if (!data) return;
    const info = metrics(data);
    info.sizes = await Promise.all(info.media.map(mediaByteSize));
    info.average = info.sizes.length ? Math.round(info.sizes.reduce((a, b) => a + b, 0) / info.sizes.length) : 0;
    const backup = await latestBackup();
    let lastPublish = null;
    try { lastPublish = JSON.parse(localStorage.getItem("duomei_last_publish") || "null"); } catch {}
    const repositoryBytes = info.storageBytes + info.sizes.reduce((sum, size) => sum + size, 0);
    const repositoryLimit = 1024 * 1024 * 1024;
    const repositoryPercent = Math.min(100, repositoryBytes / repositoryLimit * 100);
    const averageUpload = Math.max(info.average, 550 * 1024);
    animateNumber(document.getElementById("dashboardJourneys"), data.journeys.length);
    animateNumber(document.getElementById("dashboardPhotos"), info.media.length);
    animateNumber(document.getElementById("dashboardPending"), info.pending);
    document.getElementById("dashboardAverage").textContent = `平均 ${sizeLabel(info.average)}`;
    document.getElementById("dashboardJson").textContent = sizeLabel(info.storageBytes);
    document.getElementById("dashboardIndexedDb").textContent = "正常";
    document.getElementById("dashboardBackup").textContent = backup ? relativeTime(backup.savedAt) : "暂无";
    document.getElementById("dashboardDraft").textContent = `草稿：${window.ArchiveCMS.loadDraft() ? "有" : "无"}`;
    const largest = info.sizes.length ? Math.max(...info.sizes) : 0;
    const smallest = info.sizes.length ? Math.min(...info.sizes) : 0;
    document.getElementById("dashboardRange").textContent = `${sizeLabel(largest)} / ${sizeLabel(smallest)}`;
    document.getElementById("dashboardPublish").textContent = lastPublish ? relativeTime(lastPublish.savedAt) : "暂无";
    document.getElementById("dashboardCommit").textContent = lastPublish?.commit ? `Commit ${lastPublish.commit.slice(0, 7)}` : "等待记录";
    document.getElementById("repositoryUsage").textContent = `${sizeLabel(repositoryBytes)} / 1 GB`;
    document.getElementById("repositoryPercent").textContent = `${repositoryPercent.toFixed(1)}%`;
    document.getElementById("repositoryGauge").style.width = `${Math.max(1, repositoryPercent)}%`;
    document.getElementById("estimatedPhotos").textContent = `预计约 ${Math.max(0, Math.floor((repositoryLimit - repositoryBytes) / averageUpload))} 张`;
    animateNumber(document.getElementById("healthScore"), info.score);
    document.getElementById("healthRing").style.setProperty("--score", info.score);
    document.getElementById("healthLabel").textContent = info.score >= 90 ? "Excellent" : info.score >= 75 ? "Good" : "需要整理";
    document.getElementById("healthAdvice").textContent = info.pending
      ? `${info.pending} 张图片等待发布`
      : info.emptySlots
        ? `${info.emptySlots} 个空图片槽位`
        : "档案状态良好";
    const [greeting, line] = welcomeCopy();
    document.getElementById("studioGreeting").textContent = greeting;
    document.getElementById("studioWelcomeLine").textContent = line;
    animateNumber(document.getElementById("daysSincePublish"), Math.max(0, Math.floor((Date.now() - firstPublishDate(data.journeys)) / 86400000)));
    animateNumber(document.getElementById("welcomeJourneys"), data.journeys.length);
    animateNumber(document.getElementById("welcomePhotos"), info.media.length);
  }

  async function renderPanel(type) {
    const panel = document.getElementById("adminPanel");
    const data = window.ArchiveApp.state.data;
    const info = metrics(data);
    info.sizes = await Promise.all(info.media.map(mediaByteSize));
    info.average = info.sizes.length ? Math.round(info.sizes.reduce((a, b) => a + b, 0) / info.sizes.length) : 0;
    panel.hidden = false;
    if (type === "media") {
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Library</span><h2>Media</h2><p>${info.media.length} 张已引用图片，${info.pending} 张等待发布，${info.emptySlots} 个空槽位。</p></div>
        <label class="studio-search"><span>搜索图片</span><input id="mediaSearch" type="search" placeholder="Journey / Cover / Gallery"></label></header>
        <div class="media-manager-grid">${info.media.map((item, mediaIndex) => `<article>
          <img src="${item.src}" alt="">
          <div class="media-card-head"><strong>${item.city}</strong><span class="sync-badge ${item.src.startsWith("data:") ? "pending" : "synced"}">${item.src.startsWith("data:") ? "未发布" : "已同步"}</span></div>
          <span>${item.type}</span>
          <dl class="media-facts">
            <div><dt>大小</dt><dd>${sizeLabel(item.outputBytes || info.sizes[mediaIndex] || 0)}</dd></div>
            <div><dt>尺寸</dt><dd>${item.width && item.height ? `${item.width} × ${item.height}` : "暂无"}</dd></div>
            <div><dt>上传</dt><dd>${item.uploadedAt ? relativeTime(item.uploadedAt) : "历史图片"}</dd></div>
            <div><dt>引用</dt><dd>${item.references || 1} 处</dd></div>
          </dl>
          <div class="media-card-actions">
            <button type="button" data-media-reference="${item.slug}">查看引用</button>
            ${item.id ? `<button class="edit-only" type="button" data-upload-gallery="${item.id}" data-city="${item.cityId}">替换</button><button class="edit-only danger" type="button" data-action="delete-photo" data-city="${item.cityId}" data-photo="${item.id}">删除</button>` : item.type.startsWith("Cover") ? `<button class="edit-only" type="button" data-upload-cover="${item.cityId}">替换</button><button class="edit-only danger" type="button" data-action="delete-cover" data-city="${item.cityId}">删除</button>` : ""}
          </div>
        </article>`).join("") || "<p>还没有图片。</p>"}</div>`;
    }
    if (type === "repository") {
      const largest = info.sizes.length ? Math.max(...info.sizes) : 0;
      const smallest = info.sizes.length ? Math.min(...info.sizes) : 0;
      const repositoryBytes = info.storageBytes + info.sizes.reduce((sum, size) => sum + size, 0);
      const percent = Math.min(100, repositoryBytes / (1024 * 1024 * 1024) * 100);
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Archive</span><h2>Repository</h2><p>浏览器可见数据估算，精确仓库大小以 GitHub Insights 为准。</p></div></header>
        <section class="repository-hero">
          <div><span>Repository Usage</span><strong>${percent.toFixed(1)}%</strong><small>${sizeLabel(repositoryBytes)} / 1 GB</small></div>
          <div class="repository-ring" style="--repository:${percent}"><span>${Math.max(0, Math.floor((1024 * 1024 * 1024 - repositoryBytes) / Math.max(info.average, 550 * 1024)))}</span><small>预计可上传</small></div>
        </section>
        <div class="repository-wide-gauge"><span style="width:${Math.max(1, percent)}%"></span></div>
        <div class="repository-grid">
          <section><span>本地 JSON</span><strong>${sizeLabel(info.storageBytes)}</strong></section>
          <section><span>图片数量</span><strong>${info.media.length}</strong></section>
          <section><span>平均图片</span><strong>${sizeLabel(info.average)}</strong></section>
          <section><span>最大图片</span><strong>${sizeLabel(largest)}</strong></section>
          <section><span>最小图片</span><strong>${sizeLabel(smallest)}</strong></section>
          <section><span>未发布图片</span><strong>${info.pending}</strong></section>
        </div>`;
    }
    if (type === "health") {
      const advice = [
        info.pending ? `${info.pending} 张图片等待发布，完成后 Health 会提高。` : "所有图片都已同步。",
        info.emptySlots ? `${info.emptySlots} 个空白 Gallery 槽位只会在编辑模式显示。` : "没有多余空槽位。",
        info.storageBytes > 4 * 1024 * 1024 ? "本地 JSON 较大，建议尽快发布并清理草稿。" : "本地 JSON 体积健康。",
        "最近 10 个恢复点会保存在 IndexedDB。"
      ];
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">System</span><h2>Health</h2><p>作品档案、图片、缓存与恢复能力的综合状态。</p></div></header>
        <section class="health-detail"><div class="health-ring large" style="--score:${info.score}"><div><strong>${info.score}</strong><small>/ 100</small></div></div>
          <div><h3>${info.score >= 90 ? "Excellent" : info.score >= 75 ? "Good" : "Needs attention"}</h3>${advice.map((text, index) => `<p><span class="health-state ${index === 0 && info.pending ? "warning" : "good"}"></span>${text}</p>`).join("")}</div>
        </section>`;
    }
    if (type === "home") {
      const sections = [...(data.site.homeSections || [])].sort((a, b) => a.order - b.order);
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Front Page</span><h2>Home</h2><p>管理首页文字、顺序、显示状态与布局。</p></div><button class="pill edit-only" data-action="add-home-section">添加区块</button></header>
        <div class="home-manager-list">${sections.map((section, index) => `<article>
          <span class="home-order">${String(index + 1).padStart(2, "0")}</span>
          <div><strong>${section.title || "未命名区块"}</strong><span>${section.eyebrow || "No eyebrow"} · ${section.layout}</span></div>
          <span class="visibility-badge ${section.visible ? "visible" : "hidden"}">${section.visible ? "Visible" : "Hidden"}</span>
          <div class="home-manager-actions edit-only"><button data-action="move-home-up" data-id="${section.id}">↑</button><button data-action="move-home-down" data-id="${section.id}">↓</button><button data-action="layout-home" data-id="${section.id}">布局</button><button data-action="toggle-home" data-id="${section.id}">${section.visible ? "隐藏" : "显示"}</button></div>
          <div class="home-button-fields edit-only"><label>Button<input data-home-button-label="${section.id}" value="${String(section.buttonLabel || "").replace(/"/g, "&quot;")}" placeholder="按钮文字"></label><label>URL<input data-home-button-url="${section.id}" value="${String(section.buttonUrl || "").replace(/"/g, "&quot;")}" placeholder="https://..."></label></div>
        </article>`).join("") || "<p>还没有首页区块。</p>"}</div>
        <button class="studio-open-home" type="button" data-open-home-editor>在网站中编辑文字与样式</button>`;
    }
    if (type === "settings") {
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Preferences</span><h2>Settings</h2><p>当前 Studio 的连接与编辑状态。</p></div></header>
        <div class="settings-list">
          <section><div><strong>Cloudflare Worker</strong><span>${window.ArchiveCMS.workerUrl() || "未配置"}</span></div><span class="sync-badge synced">Connected</span></section>
          <section><div><strong>管理员会话</strong><span>密钥仅保存在本次浏览器会话</span></div><span class="sync-badge synced">Protected</span></section>
          <section><div><strong>编辑安全模式</strong><span>浏览与编辑保持分离</span></div><span class="sync-badge ${window.ArchiveApp.state.editMode ? "pending" : "synced"}">${window.ArchiveApp.state.editMode ? "Editing" : "Browsing"}</span></section>
        </div>`;
    }
    if (type === "recovery") {
      const list = await backups();
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Safety</span><h2>Recovery</h2><p>自动保留最近 10 次本地备份。</p></div><button class="pill edit-only" type="button" data-manual-backup>创建手动备份</button></header>
        <div class="recovery-list">${list.map((item) => {
          const itemInfo = metrics(item.data);
          const kind = item.reason.includes("发布前") ? "发布前备份" : item.reason.includes("手动") ? "手动备份" : "自动备份";
          return `<article class="recovery-item">
            <div class="recovery-dot"></div>
            <div><strong>${new Date(item.savedAt).toLocaleString()}</strong><span>${kind} · ${item.reason}</span>
              <span class="recovery-meta"><span>${item.data.journeys.length} Journey</span><span>${itemInfo.media.length} 图片</span><span>${sizeLabel(itemInfo.storageBytes)}</span></span>
            </div>
            <div class="recovery-actions"><button type="button" data-preview-backup="${item.id}">预览</button><button class="edit-only" type="button" data-restore-backup="${item.id}">恢复</button></div>
          </article>`;
        }).join("") || "<p>还没有恢复点。</p>"}</div>`;
    }
    renderIcons(panel);
  }

  async function switchStudioView(type) {
    const home = document.getElementById("studioHome");
    const panel = document.getElementById("adminPanel");
    const shell = document.querySelector(".studio-shell");
    document.querySelectorAll("[data-studio-view]").forEach((button) => button.classList.toggle("active", button.dataset.studioView === type));
    shell?.classList.remove("sidebar-open");
    if (type === "journey") {
      closeDashboard();
      window.ArchiveApp.showHome();
      return;
    }
    const titles = { studio: "Studio", media: "Media", home: "Home", repository: "Repository", health: "Health", recovery: "Recovery", settings: "Settings" };
    document.getElementById("studioViewTitle").textContent = titles[type] || "Studio";
    home.hidden = type !== "studio";
    panel.hidden = type === "studio";
    if (type === "studio") await refreshDashboard();
    else await renderPanel(type);
  }

  function openDashboard() {
    refreshDashboard();
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    switchStudioView("studio");
    renderIcons(dialog);
  }

  function closeDashboard() {
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function operationProgress(stages, activeIndex, title = "正在处理") {
    const panel = document.getElementById("uploadProgress");
    panel.hidden = false;
    panel.classList.remove("is-complete", "is-failed");
    document.getElementById("uploadProgressTitle").textContent = title;
    document.getElementById("uploadProgressCount").textContent = `${Math.min(activeIndex + 1, stages.length)}/${stages.length}`;
    document.getElementById("uploadProgressBar").style.width = `${Math.round(Math.min(activeIndex + 1, stages.length) / stages.length * 100)}%`;
    document.getElementById("uploadProgressItems").innerHTML = stages.map((stage, index) => `
      <div data-status="${index < activeIndex ? "done" : index === activeIndex ? "active" : "waiting"}">
        <strong>${index < activeIndex ? "✓" : index === activeIndex ? "●" : "○"} ${stage}</strong>
        <span>${index < activeIndex ? "完成" : index === activeIndex ? "进行中" : "等待"}</span>
      </div>`).join("");
  }

  function completeOperation(title = "处理完成") {
    const panel = document.getElementById("uploadProgress");
    document.getElementById("uploadProgressTitle").textContent = title;
    document.getElementById("uploadProgressBar").style.width = "100%";
    panel.classList.add("is-complete");
    window.setTimeout(() => { panel.hidden = true; }, 3500);
  }

  function failOperation(message) {
    document.getElementById("uploadProgress").classList.add("is-failed");
    document.getElementById("uploadProgressTitle").textContent = "操作失败";
    const items = document.getElementById("uploadProgressItems");
    items.insertAdjacentHTML("beforeend", `<div data-status="failed"><strong>失败原因</strong><span>${String(message || "未知错误").replace(/[<>&]/g, "")}</span></div>`);
  }

  function bind() {
    renderIcons();
    document.getElementById("adminDashboard")?.addEventListener("click", openDashboard);
    document.getElementById("dashboardClose")?.addEventListener("click", closeDashboard);
    document.getElementById("dashboardContinue")?.addEventListener("click", () => {
      closeDashboard();
      document.getElementById("editToggle")?.click();
    });
    document.getElementById("studioCollapse")?.addEventListener("click", () => {
      document.querySelector(".studio-shell")?.classList.toggle("sidebar-collapsed");
    });
    document.getElementById("studioMenu")?.addEventListener("click", () => {
      document.querySelector(".studio-shell")?.classList.toggle("sidebar-open");
    });
    document.addEventListener("click", async (event) => {
      const studioButton = event.target.closest(".studio-shell button");
      if (studioButton) {
        const rect = studioButton.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "studio-ripple";
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        studioButton.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      }
      const studioView = event.target.closest("[data-studio-view]");
      if (studioView) {
        await switchStudioView(studioView.dataset.studioView);
        return;
      }
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
      const reference = event.target.closest("[data-media-reference]");
      if (reference) {
        closeDashboard();
        window.ArchiveApp.openCity(reference.dataset.mediaReference);
      }
      const preview = event.target.closest("[data-preview-backup]");
      if (preview) {
        const record = (await backups()).find((item) => String(item.id) === preview.dataset.previewBackup);
        if (!record) return;
        const itemInfo = metrics(record.data);
        const panel = document.getElementById("adminPanel");
        panel.insertAdjacentHTML("afterbegin", `<aside class="recovery-preview"><button type="button" data-close-preview aria-label="关闭">×</button><span>Recovery Preview</span><h3>${new Date(record.savedAt).toLocaleString()}</h3><p>${record.reason}</p><div><strong>${record.data.journeys.length}</strong><span>Journey</span><strong>${itemInfo.media.length}</strong><span>Photos</span><strong>${sizeLabel(itemInfo.storageBytes)}</strong><span>JSON</span></div></aside>`);
      }
      if (event.target.closest("[data-close-preview]")) event.target.closest(".recovery-preview")?.remove();
      if (event.target.closest("[data-manual-backup]")) {
        await backup(window.ArchiveApp.state.data, "手动备份");
        window.ArchiveUI?.toast("手动备份已创建");
        await renderPanel("recovery");
      }
      if (event.target.closest("[data-open-home-editor]")) {
        closeDashboard();
        window.ArchiveApp.showHome();
        if (!window.ArchiveApp.state.editMode) document.getElementById("editToggle")?.click();
        document.getElementById("homeSections")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "mediaSearch") {
        const query = event.target.value.trim().toLowerCase();
        document.querySelectorAll(".media-manager-grid article").forEach((card) => {
          card.hidden = query && !card.textContent.toLowerCase().includes(query);
        });
      }
      const sectionId = event.target.dataset.homeButtonLabel || event.target.dataset.homeButtonUrl;
      if (sectionId) {
        const section = window.ArchiveApp.state.data.site.homeSections.find((item) => item.id === sectionId);
        if (!section) return;
        if (event.target.dataset.homeButtonLabel) section.buttonLabel = event.target.value;
        if (event.target.dataset.homeButtonUrl) section.buttonUrl = event.target.value;
        window.ArchiveApp.state.hasUnpublishedChanges = true;
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
      }
    });
  }

  window.ArchiveManager = { bind, openDashboard, refreshDashboard, backup, metrics, sizeLabel, operationProgress, completeOperation, failOperation };
})();
