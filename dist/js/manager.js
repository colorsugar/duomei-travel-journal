(function () {
  const DB_NAME = "duomei_travel_archive";
  const DB_VERSION = 1;
  const BACKUPS = "backups";
  let recoveryTimer = 0;
  let pendingRecovery = null;
  let studioState = { view: "studio", scrollTop: 0 };
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
    const raw = JSON.stringify(data);
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += Math.max(1, Math.floor(raw.length / 24000))) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const signature = `${raw.length}-${hash >>> 0}`;
    const previous = (await backups())[0];
    if (previous?.signature === signature) return previous.id;
    const record = { savedAt: new Date().toISOString(), reason, data };
    record.signature = signature;
    await transaction("readwrite", (store, resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await backups();
    for (const item of all.slice(10)) await removeBackup(item.id);
  }

  function scheduleRecovery(data, reason = "内容修改") {
    pendingRecovery = { data, reason };
    clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(async () => {
      const pending = pendingRecovery;
      pendingRecovery = null;
      if (pending) await backup(pending.data, pending.reason).catch(() => {});
    }, 45000);
  }

  function cancelScheduledRecovery() {
    clearTimeout(recoveryTimer);
    pendingRecovery = null;
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
        type: city.status === "asset" ? "Home Hero" : city.cardImage === city.coverImage ? "Cover · Card" : "Cover",
        city: city.status === "asset" ? "Home" : city.title,
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
    let publishState = null;
    try { publishState = JSON.parse(localStorage.getItem("duomei_publish_state") || "null"); } catch {}
    const commitAccepted = ["commit-success", "waiting-pages", "pages-ready", "published"].includes(publishState?.state) || lastPublish?.status === "waiting-pages";
    const visiblePending = commitAccepted ? 0 : info.pending;
    const repositoryBytes = info.storageBytes + info.sizes.reduce((sum, size) => sum + size, 0);
    const repositoryLimit = 1024 * 1024 * 1024;
    const repositoryPercent = Math.min(100, repositoryBytes / repositoryLimit * 100);
    const averageUpload = Math.max(info.average, 550 * 1024);
    const publicJourneys = data.journeys.filter((city) => city.status !== "asset");
    animateNumber(document.getElementById("dashboardJourneys"), publicJourneys.length);
    animateNumber(document.getElementById("dashboardPhotos"), info.media.length);
    animateNumber(document.getElementById("dashboardPending"), visiblePending);
    document.getElementById("dashboardAverage").textContent = `平均 ${sizeLabel(info.average)}`;
    document.getElementById("dashboardJson").textContent = sizeLabel(info.storageBytes);
    document.getElementById("dashboardIndexedDb").textContent = "正常";
    document.getElementById("dashboardBackup").textContent = backup ? relativeTime(backup.savedAt) : "暂无";
    document.getElementById("dashboardDraft").textContent = `草稿：${window.ArchiveCMS.loadDraft() ? "有" : "无"}`;
    const largest = info.sizes.length ? Math.max(...info.sizes) : 0;
    const smallest = info.sizes.length ? Math.min(...info.sizes) : 0;
    document.getElementById("dashboardRange").textContent = `${sizeLabel(largest)} / ${sizeLabel(smallest)}`;
    document.getElementById("dashboardPublish").textContent = lastPublish ? relativeTime(lastPublish.savedAt) : "暂无";
    document.getElementById("dashboardCommit").textContent = lastPublish?.status === "waiting-pages"
      ? "正在等待 Pages"
      : lastPublish?.commit
        ? `已发布 · ${lastPublish.commit.slice(0, 7)}`
        : "等待记录";
    document.getElementById("repositoryUsage").textContent = `${sizeLabel(repositoryBytes)} / 1 GB`;
    document.getElementById("repositoryPercent").textContent = `${repositoryPercent.toFixed(1)}%`;
    document.getElementById("repositoryGauge").style.width = `${Math.max(1, repositoryPercent)}%`;
    document.getElementById("estimatedPhotos").textContent = `预计约 ${Math.max(0, Math.floor((repositoryLimit - repositoryBytes) / averageUpload))} 张`;
    animateNumber(document.getElementById("healthScore"), info.score);
    document.getElementById("healthRing").style.setProperty("--score", info.score);
    document.getElementById("healthLabel").textContent = info.score >= 90 ? "优秀" : info.score >= 75 ? "良好" : "需要整理";
    document.getElementById("healthAdvice").textContent = visiblePending
      ? `${visiblePending} 张图片等待发布`
      : commitAccepted && lastPublish?.status === "waiting-pages"
        ? "Commit 已成功，正在等待 GitHub Pages"
      : info.emptySlots
        ? `${info.emptySlots} 个空图片槽位`
        : "档案状态良好";
    document.getElementById("studioPublishTitle").textContent = lastPublish?.status === "waiting-pages"
      ? "Commit 已同步，正在等待 GitHub Pages"
      : visiblePending
        ? `${visiblePending} 张图片等待发布`
        : "作品已发布并同步";
    document.getElementById("studioPublishText").textContent = lastPublish?.status === "waiting-pages"
      ? "图片与 JSON 已进入 GitHub，线上页面仍在部署。"
      : visiblePending
        ? "进入编辑模式完成发布后，线上作品集才会更新。"
        : "本地档案、GitHub 与当前发布状态一致。";
    const publishNow = document.getElementById("studioPublishNow");
    if (publishNow) publishNow.hidden = !visiblePending && !window.ArchiveApp.state.hasUnpublishedChanges;
    const pendingJourney = publicJourneys.find((city) => [city.coverImage, ...(city.gallery || []).map((photo) => photo.src)].some((src) => String(src || "").startsWith("data:")));
    const assistant = [
      visiblePending ? `今天还有 ${visiblePending} 张图片等待发布。` : commitAccepted ? "图片已提交，正在等待线上同步。" : "当前没有等待发布的图片。",
      repositoryPercent < 80 ? `Repository 使用率 ${repositoryPercent.toFixed(1)}%，容量正常。` : "Repository 容量偏高，建议整理旧图片。",
      info.average > 3 * 1024 * 1024 ? `图片平均 ${sizeLabel(info.average)}，建议使用 82% WebP。` : `图片平均 ${sizeLabel(info.average)}，压缩状态良好。`,
      pendingJourney ? `建议先完成「${pendingJourney.title}」Journey。` : `发布后 Health 可保持在 ${info.score} 分。`
    ];
    document.getElementById("studioAssistantTitle").textContent = pendingJourney ? `先完成「${pendingJourney.title}」吧。` : "你的作品档案状态良好。";
    document.getElementById("studioAssistantList").innerHTML = assistant.map((text, index) => `<p><span class="health-state ${index === 0 && visiblePending ? "warning" : "good"}"></span>${text}</p>`).join("");
    const [greeting, line] = welcomeCopy();
    document.getElementById("studioGreeting").textContent = greeting;
    document.getElementById("studioWelcomeLine").textContent = line;
    animateNumber(document.getElementById("daysSincePublish"), Math.max(0, Math.floor((Date.now() - firstPublishDate(data.journeys)) / 86400000)));
    animateNumber(document.getElementById("welcomeJourneys"), publicJourneys.length);
    animateNumber(document.getElementById("welcomePhotos"), info.media.length);
  }

  async function renderPanel(type) {
    const panel = document.getElementById("adminPanel");
    const data = window.ArchiveApp.state.data;
    const info = metrics(data);
    let publishState = null;
    try { publishState = JSON.parse(localStorage.getItem("duomei_last_publish") || "null"); } catch {}
    info.sizes = await Promise.all(info.media.map(mediaByteSize));
    info.average = info.sizes.length ? Math.round(info.sizes.reduce((a, b) => a + b, 0) / info.sizes.length) : 0;
    panel.hidden = false;
    if (type === "journey") {
      const journeys = data.journeys.filter((city) => city.status !== "asset");
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">Content Manager</span><h2>内容</h2><p>管理「游 / 景 / 想 / 文」四个频道的内容。</p></div><button class="pill edit-only" data-action="add-city">新增旅行</button></header>
        <div class="content-tabs"><button class="active" type="button">游</button><button type="button" disabled>景</button><button type="button" disabled>想</button><button type="button" disabled>文</button></div>
        <div class="studio-journey-list">${journeys.map((city, index) => `<article>
          <span class="journey-index">${String(index + 1).padStart(2, "0")}</span>
          <div class="journey-preview">${city.cardImage || city.coverImage ? `<img src="${city.cardThumb || city.coverThumb || city.cardImage || city.coverImage}" alt="">` : ""}</div>
          <div><strong>${city.title}</strong><span>${city.place || "未填写地点"} · ${city.published || "未填写日期"}</span><small>${(city.gallery || []).filter((photo) => photo.src).length} 张照片 · ${(city.tags || []).length} 个标签</small></div>
          <span class="visibility-badge ${city.status === "public" ? "visible" : "hidden"}">${city.status === "public" ? "公开" : city.status === "draft" ? "草稿" : city.status || "未设置"}</span>
          <div class="journey-row-actions"><button type="button" data-journey-view="${city.slug}">预览</button><button class="edit-only" type="button" data-action="edit-city" data-id="${city.id}">编辑</button></div>
        </article>`).join("") || "<p>还没有 Journey。</p>"}</div>`;
    }
    if (type === "media") {
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">媒体库</span><h2>图片管理</h2><p>${info.media.length} 张已引用图片，${info.pending} 张等待发布，${info.emptySlots} 个空槽位。</p></div>
        <label class="studio-search"><span>搜索图片</span><input id="mediaSearch" type="search" placeholder="旅程 / 封面 / 相册"></label></header>
        <div class="media-batch edit-only"><span>批量操作</span><button type="button" data-media-download-selected>下载</button><button type="button" data-media-publish-selected>发布</button><button class="danger" type="button" data-media-delete-selected>删除</button></div>
        <div class="media-manager-grid">${info.media.map((item, mediaIndex) => {
          const status = item.src.startsWith("data:") ? "pending" : publishState?.status === "waiting-pages" ? "waiting" : "published";
          const statusLabel = status === "pending" ? "未发布" : status === "waiting" ? "正在等待 Pages" : "已发布";
          const compression = item.originalBytes && item.outputBytes ? Math.max(0, Math.round((1 - item.outputBytes / item.originalBytes) * 100)) : null;
          return `<article>
          <label class="media-select edit-only"><input type="checkbox" data-media-select data-city="${item.cityId}" data-photo="${item.id || ""}" data-kind="${item.type}"><span></span></label>
          <img src="${item.src}" alt="">
          <div class="media-card-head"><strong>${item.city}</strong><span class="sync-badge ${status}">${statusLabel}</span></div>
          <span>${item.type === "Cover" ? "封面" : item.type === "Gallery" ? "相册" : item.type === "Home" ? "首页" : item.type}</span>
          <dl class="media-facts">
            <div><dt>大小</dt><dd>${sizeLabel(item.outputBytes || info.sizes[mediaIndex] || 0)}</dd></div>
            <div><dt>尺寸</dt><dd>${item.width && item.height ? `${item.width} × ${item.height}` : "暂无"}</dd></div>
            <div><dt>上传</dt><dd>${item.uploadedAt ? relativeTime(item.uploadedAt) : "历史图片"}</dd></div>
            <div><dt>发布</dt><dd>${status === "published" ? relativeTime(publishState?.savedAt) : statusLabel}</dd></div>
            <div><dt>引用</dt><dd>${item.references || 1} 处</dd></div>
            <div><dt>比例</dt><dd>${item.aspectMode || (item.width && item.height ? "原始比例" : "未知")}</dd></div>
            <div><dt>压缩</dt><dd>${compression === null ? "暂无" : `${compression}%`}</dd></div>
            <div><dt>EXIF</dt><dd>${item.camera || "暂无"}</dd></div>
          </dl>
          <div class="media-card-actions">
            <button type="button" data-media-reference="${item.slug}">查看引用</button>
            ${item.id ? `<button class="edit-only" type="button" data-upload-gallery="${item.id}" data-city="${item.cityId}">替换</button><button class="edit-only danger" type="button" data-action="delete-photo" data-city="${item.cityId}" data-photo="${item.id}">删除</button>` : item.type.startsWith("Cover") ? `<button class="edit-only" type="button" data-upload-cover="${item.cityId}">替换</button><button class="edit-only danger" type="button" data-action="delete-cover" data-city="${item.cityId}">删除</button>` : ""}
          </div>
        </article>`;
        }).join("") || "<p>还没有图片。</p>"}</div>`;
    }
    if (type === "repository") {
      const largest = info.sizes.length ? Math.max(...info.sizes) : 0;
      const smallest = info.sizes.length ? Math.min(...info.sizes) : 0;
      const repositoryBytes = info.storageBytes + info.sizes.reduce((sum, size) => sum + size, 0);
      const percent = Math.min(100, repositoryBytes / (1024 * 1024 * 1024) * 100);
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">档案库</span><h2>存储库</h2><p>浏览器可见数据估算，精确仓库大小以 GitHub Insights 为准。</p></div></header>
        <section class="repository-hero">
          <div><span>存储库使用率</span><strong>${percent.toFixed(1)}%</strong><small>${sizeLabel(repositoryBytes)} / 1 GB</small></div>
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
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">系统状态</span><h2>健康状态</h2><p>作品档案、图片、缓存与恢复能力的综合状态。</p></div></header>
        <section class="health-detail"><div class="health-ring large" style="--score:${info.score}"><div><strong>${info.score}</strong><small>/ 100</small></div></div>
          <div><h3>${info.score >= 90 ? "优秀" : info.score >= 75 ? "良好" : "需要关注"}</h3>${advice.map((text, index) => `<p><span class="health-state ${index === 0 && info.pending ? "warning" : "good"}"></span>${text}</p>`).join("")}</div>
        </section>`;
    }
    if (type === "home") {
      const sections = [...(data.site.homeSections || [])].sort((a, b) => a.order - b.order);
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">首页</span><h2>首页内容</h2><p>管理首页文字、顺序、显示状态与布局。</p></div><button class="pill edit-only" data-action="add-home-section">添加标题区块</button></header>
        <section class="hero-settings">
          <header><div><span>首页外观</span><h3>首页背景与精选内容</h3></div><label class="hero-upload edit-only">上传背景<input id="heroBackgroundInput" type="file" accept="image/*"></label></header>
          <div id="heroMiniPreview" class="hero-mini-preview"><span>${data.site.title || "Duomei"}</span></div>
          <div class="hero-setting-grid">
            <label>背景模式<select data-hero-setting="mode"><option value="art">旅行插画</option><option value="image">图片</option><option value="color">纯色</option><option value="linear">线性渐变</option><option value="mesh">网格渐变</option><option value="aurora">极光渐变</option><option value="glass">玻璃</option></select></label>
            <label>纯色<input type="color" data-hero-setting="color" value="${data.site.hero.color}"></label>
            <label class="wide">线性渐变<input data-hero-setting="gradient" value="${String(data.site.hero.gradient || "").replace(/"/g, "&quot;")}"></label>
            <label>Hero 高度<input type="range" min="60" max="110" data-hero-setting="height" value="${data.site.hero.height}"><span>${data.site.hero.height}vh</span></label>
            <label>遮罩<input type="range" min="0" max=".7" step=".01" data-hero-setting="overlay" value="${data.site.hero.overlay}"></label>
            <label>模糊<input type="range" min="0" max="30" step="1" data-hero-setting="blur" value="${data.site.hero.blur}"></label>
            <label>辉光<input type="range" min="0" max=".7" step=".01" data-hero-setting="glow" value="${data.site.hero.glow}"></label>
            <label>对齐<select data-hero-setting="align"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
            <label>精选内容<select data-hero-setting="featuredMode"><option value="manual">手动</option><option value="recent">最近发布</option><option value="random">随机作品</option><option value="today">今日推荐</option><option value="week">本周精选</option><option value="quote">今日引用</option></select></label>
            <label>指定作品<select data-hero-setting="featuredJourney"><option value="">不指定</option>${data.journeys.filter((city) => city.status !== "asset").map((city) => `<option value="${city.id}">${city.title}</option>`).join("")}</select></label>
            <label class="wide">引用<textarea data-hero-setting="quote" rows="2">${data.site.hero.quote || ""}</textarea></label>
            <label>作者<input data-hero-setting="quoteAuthor" value="${String(data.site.hero.quoteAuthor || "").replace(/"/g, "&quot;")}"></label>
            <label class="setting-check"><input type="checkbox" data-hero-setting="noise" ${data.site.hero.noise !== false ? "checked" : ""}> 噪点</label>
            <label class="setting-check"><input type="checkbox" data-hero-setting="grain" ${data.site.hero.grain !== false ? "checked" : ""}> 颗粒</label>
          </div>
        </section>
        <div class="home-manager-list">${sections.map((section, index) => `<article>
          <span class="home-order">${String(index + 1).padStart(2, "0")}</span>
          <div><strong>${section.title || "未命名区块"}</strong><span>${section.eyebrow || "无小标题"} · ${section.layout}</span></div>
          <span class="visibility-badge ${section.visible ? "visible" : "hidden"}">${section.visible ? "显示" : "隐藏"}</span>
          <div class="home-manager-actions edit-only"><button data-action="move-home-up" data-id="${section.id}">↑</button><button data-action="move-home-down" data-id="${section.id}">↓</button><button data-action="layout-home" data-id="${section.id}">布局</button><button data-action="toggle-home" data-id="${section.id}">${section.visible ? "隐藏" : "显示"}</button></div>
          <div class="home-button-fields edit-only"><label>按钮<input data-home-button-label="${section.id}" value="${String(section.buttonLabel || "").replace(/"/g, "&quot;")}" placeholder="按钮文字"></label><label>链接<input data-home-button-url="${section.id}" value="${String(section.buttonUrl || "").replace(/"/g, "&quot;")}" placeholder="https://..."></label></div>
        </article>`).join("") || "<p>还没有首页区块。</p>"}</div>
        <button class="studio-open-home" type="button" data-open-home-editor>在网站中编辑文字与样式</button>`;
      panel.querySelectorAll("[data-hero-setting]").forEach((control) => {
        const value = data.site.hero[control.dataset.heroSetting];
        if (control.type !== "checkbox" && value !== undefined) control.value = value;
      });
      updateHeroPreview();
    }
    if (type === "settings") {
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">偏好设置</span><h2>设置</h2><p>当前工作室的连接与编辑状态。</p></div></header>
        <div class="settings-list">
          <section><div><strong>Cloudflare Worker</strong><span>${window.ArchiveCMS.workerUrl() || "未配置"}</span></div><span class="sync-badge synced">已连接</span></section>
          <section><div><strong>管理员会话</strong><span>密钥仅保存在本次浏览器会话</span></div><span class="sync-badge synced">受保护</span></section>
          <section><div><strong>编辑安全模式</strong><span>浏览与编辑保持分离</span></div><span class="sync-badge ${window.ArchiveApp.state.editMode ? "pending" : "synced"}">${window.ArchiveApp.state.editMode ? "编辑中" : "浏览中"}</span></section>
        </div>
        <div class="settings-grid">
          <label>主题<select data-site-setting="theme"><option value="light">浅色</option><option value="dark">深色</option><option value="auto">自动</option></select></label>
          <label>图片质量<select data-site-setting="imageQuality"><option value=".75">均衡 · 75%</option><option value=".82">高清 · 82%</option><option value=".9">最高 · 90%</option></select></label>
          <label>默认背景<select data-site-setting="defaultBackground"><option value="art">旅行插画</option><option value="linear">线性渐变</option><option value="mesh">网格渐变</option><option value="aurora">极光渐变</option><option value="glass">玻璃</option></select></label>
          <label>动画<select data-site-setting="animation"><option value="normal">普通</option><option value="smooth">柔和</option><option value="performance">性能优先</option></select></label>
          <label>照片布局<select data-site-setting="galleryLayout"><option value="auto">自动布局</option><option value="masonry">瀑布流</option><option value="justified">两端对齐</option><option value="fixed">固定网格</option></select></label>
          <label>首页风格<select data-site-setting="heroStyle"><option value="art">旅行插画</option><option value="image">图片</option><option value="glass">玻璃</option></select></label>
          <label>语言<select data-site-setting="language"><option value="zh-CN">中文</option><option value="en" disabled>English（开发中）</option><option value="ja" disabled>日本語（开发中）</option></select></label>
        </div>`;
      panel.querySelectorAll("[data-site-setting]").forEach((control) => {
        control.value = String(data.settings[control.dataset.siteSetting] ?? "");
      });
    }
    if (type === "recovery") {
      const list = await backups();
      panel.innerHTML = `<header class="panel-heading"><div><span class="panel-kicker">数据安全</span><h2>恢复</h2><p>自动保留最近 10 次本地备份。</p></div><button class="pill edit-only" type="button" data-manual-backup>创建手动备份</button></header>
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
    if (type === "home") enhanceHomeSectionActions(panel);
    if (type === "settings") enhanceSettingsPanel(panel, data);
    localizeStudioPanel(panel);
    renderIcons(panel);
  }

  async function switchStudioView(type) {
    const home = document.getElementById("studioHome");
    const panel = document.getElementById("adminPanel");
    const shell = document.querySelector(".studio-shell");
    const scroller = document.querySelector(".studio-scroll");
    if (scroller && studioState.view) studioState.scrollTop = scroller.scrollTop;
    studioState.view = type;
    document.querySelectorAll("[data-studio-view]").forEach((button) => button.classList.toggle("active", button.dataset.studioView === type));
    shell?.classList.remove("sidebar-open");
    const titles = { studio: "工作室", journey: "内容", media: "媒体", home: "首页", repository: "存储库", health: "健康状态", recovery: "恢复", settings: "设置" };
    document.getElementById("studioViewTitle").textContent = titles[type] || "Studio";
    home.hidden = type !== "studio";
    panel.hidden = type === "studio";
    if (type === "studio") await refreshDashboard();
    else await renderPanel(type);
    requestAnimationFrame(() => {
      const nextScroller = document.querySelector(".studio-scroll");
      if (nextScroller && studioState.view === type) nextScroller.scrollTop = studioState.scrollTop || 0;
    });
  }

  function updateHeroPreview() {
    const preview = document.getElementById("heroMiniPreview");
    const data = window.ArchiveApp?.state?.data;
    if (!preview || !data) return;
    const hero = data.site.hero || {};
    const asset = data.journeys.find((city) => city.id === hero.backgroundAssetId);
    preview.dataset.mode = hero.mode || "art";
    preview.style.backgroundColor = hero.color || "#f7f3eb";
    preview.style.backgroundImage = hero.mode === "image" && asset?.coverImage
      ? `linear-gradient(rgba(20,25,24,${hero.overlay || 0}),rgba(20,25,24,${hero.overlay || 0})),url("${asset.coverImage}")`
      : hero.mode === "linear"
        ? hero.gradient
        : "";
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
    preview.style.filter = `blur(${Number(hero.blur || 0) * .15}px)`;
  }

  function localizeStudioPanel(panel) {
    if (!panel) return;
    const replacements = [
      ["Front Page", "首页"],
      ["Overlay", "遮罩"],
      ["Blur", "模糊"],
      ["Glow", "辉光"],
      ["Featured", "精选内容"],
      ["Manual", "手动"],
      ["Noise", "噪点"],
      ["Grain", "颗粒"],
      ["Quote", "引用"],
      ["Today’s Quote", "今日引用"],
      ["Pure Color", "纯色"],
      ["Mesh Gradient", "网格渐变"],
      ["Travel Art", "旅行插画"],
      ["Image", "图片"],
      ["Glass", "玻璃"],
      ["Theme", "主题"],
      ["Light", "浅色"],
      ["Dark", "深色"],
      ["Auto", "自动"],
      ["Animation", "动画"],
      ["Normal", "普通"],
      ["Smooth", "柔和"],
      ["Performance", "性能优先"],
      ["Left", "左对齐"],
      ["Center", "居中"],
      ["Right", "右对齐"],
      ["Button", "按钮"],
      ["URL", "链接"]
    ];
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue;
      replacements.forEach(([from, to]) => { value = value.replaceAll(from, to); });
      node.nodeValue = value;
    });
  }

  function enhanceHomeSectionActions(panel) {
    panel.querySelectorAll(".home-manager-actions").forEach((actions) => {
      if (actions.querySelector("[data-action='delete-home']")) return;
      const id = actions.querySelector("[data-id]")?.dataset.id;
      if (!id) return;
      actions.insertAdjacentHTML("beforeend", `<button data-action="delete-home" data-id="${id}">删除</button>`);
    });
  }

  function enhanceSettingsPanel(panel, data) {
    if (!panel || panel.querySelector("[data-site-setting='adminEntryLabel']")) return;
    const grid = panel.querySelector(".settings-grid");
    if (!grid) return;
    grid.insertAdjacentHTML("beforeend", `
      <label>后台入口文案<input data-site-setting="adminEntryLabel" value="${String(data.settings.adminEntryLabel || "编").replace(/"/g, "&quot;")}"></label>
    `);
  }

  async function afterPublish(status = "published") {
    const lastPublish = JSON.parse(localStorage.getItem("duomei_last_publish") || "null");
    if (lastPublish) {
      lastPublish.status = status;
      localStorage.setItem("duomei_last_publish", JSON.stringify(lastPublish));
    }
    localStorage.setItem("duomei_publish_state", JSON.stringify({
      state: status === "waiting-pages" ? "waiting-pages" : "published",
      savedAt: new Date().toISOString(),
      commit: lastPublish?.commit || ""
    }));
    await refreshDashboard();
    const active = document.querySelector("[data-studio-view].active")?.dataset.studioView;
    if (active && active !== "studio" && active !== "journey") await renderPanel(active);
  }

  function openDashboard() {
    refreshDashboard();
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    switchStudioView(studioState.view || "studio");
    renderIcons(dialog);
  }

  function closeDashboard() {
    const scroller = document.querySelector(".studio-scroll");
    if (scroller) studioState.scrollTop = scroller.scrollTop;
    const dialog = document.getElementById("dashboardDialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function operationProgress(stages, activeIndex, title = "正在处理") {
    const panel = document.getElementById("uploadProgress");
    clearTimeout(panel.hideTimer);
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
    clearTimeout(panel.hideTimer);
    panel.hideTimer = window.setTimeout(() => { panel.hidden = true; }, 3500);
  }

  function failOperation(message) {
    document.getElementById("uploadProgress").classList.add("is-failed");
    document.getElementById("uploadProgressTitle").textContent = "操作失败";
    const items = document.getElementById("uploadProgressItems");
    items.insertAdjacentHTML("beforeend", `<div data-status="failed"><strong>失败原因</strong><span>${String(message || "未知错误").replace(/[<>&]/g, "")}</span></div>`);
  }

  function failOperationGlass(message) {
    const panel = document.getElementById("uploadProgress");
    panel.hidden = false;
    panel.classList.add("is-failed");
    document.getElementById("uploadProgressTitle").textContent = "操作失败";
    const items = document.getElementById("uploadProgressItems");
    items.insertAdjacentHTML("beforeend", `<div data-status="failed"><strong>失败原因</strong><span>${String(message || "未知错误").replace(/[<>&]/g, "")}</span></div>`);
    clearTimeout(panel.hideTimer);
    const hide = () => { if (!panel.matches(":hover")) panel.hidden = true; };
    panel.hideTimer = window.setTimeout(hide, 12000);
    panel.addEventListener("mouseleave", () => {
      clearTimeout(panel.hideTimer);
      panel.hideTimer = window.setTimeout(hide, 1200);
    }, { once: true });
  }

  function bind() {
    renderIcons();
    document.getElementById("adminDashboard")?.addEventListener("click", openDashboard);
    document.getElementById("dashboardClose")?.addEventListener("click", closeDashboard);
    document.getElementById("dashboardContinue")?.addEventListener("click", () => {
      closeDashboard();
      document.getElementById("editToggle")?.click();
    });
    document.getElementById("studioToggleEditor")?.addEventListener("click", () => {
      document.getElementById("editToggle")?.click();
    });
    document.getElementById("studioPublishNow")?.addEventListener("click", () => {
      window.ArchiveAdmin?.publish?.();
    });
    document.getElementById("studioViewSite")?.addEventListener("click", () => {
      if (window.ArchiveApp.state.editMode) document.getElementById("editToggle")?.click();
      closeDashboard();
      window.ArchiveApp.showHome();
    });
    document.getElementById("studioCollapse")?.addEventListener("click", () => {
      document.querySelector(".studio-shell")?.classList.toggle("sidebar-collapsed");
      document.querySelector(".studio-shell")?.classList.remove("sidebar-open");
    });
    document.getElementById("studioMenu")?.addEventListener("click", () => {
      document.querySelector(".studio-shell")?.classList.toggle("sidebar-open");
    });
    document.addEventListener("click", async (event) => {
      const shell = document.querySelector(".studio-shell");
      if (shell?.classList.contains("sidebar-open") && !event.target.closest(".studio-sidebar, #studioMenu")) {
        shell.classList.remove("sidebar-open");
      }
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
        document.querySelector(".studio-shell")?.classList.remove("sidebar-open");
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
        panel.insertAdjacentHTML("afterbegin", `<aside class="recovery-preview"><button type="button" data-close-preview aria-label="关闭">×</button><span>恢复点预览</span><h3>${new Date(record.savedAt).toLocaleString()}</h3><p>${record.reason}</p><div><strong>${record.data.journeys.length}</strong><span>旅程</span><strong>${itemInfo.media.length}</strong><span>照片</span><strong>${sizeLabel(itemInfo.storageBytes)}</strong><span>JSON</span></div></aside>`);
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
      if (event.target.closest("[data-media-download-selected]")) {
        const selected = [...document.querySelectorAll("[data-media-select]:checked")];
        if (!selected.length) return window.ArchiveUI?.toast("请先选择图片");
        selected.forEach((input, index) => {
          const city = window.ArchiveApp.state.data.journeys.find((item) => item.id === input.dataset.city);
          const photo = city?.gallery.find((item) => item.id === input.dataset.photo);
          const src = photo?.src || (input.dataset.kind.startsWith("Cover") || input.dataset.kind === "Home Hero" ? city?.coverImage : city?.cardImage);
          if (!src) return;
          window.setTimeout(() => {
            const link = document.createElement("a");
            link.href = src;
            link.download = `${city?.slug || "photo"}-${input.dataset.photo || input.dataset.kind}.webp`;
            link.click();
          }, index * 180);
        });
      }
      if (event.target.closest("[data-media-publish-selected]")) {
        if (!document.querySelector("[data-media-select]:checked")) return window.ArchiveUI?.toast("请先选择图片");
        document.getElementById("adminPublish")?.click();
      }
      if (event.target.closest("[data-media-delete-selected]")) {
        const selected = [...document.querySelectorAll("[data-media-select]:checked")];
        if (!selected.length) return window.ArchiveUI?.toast("请先选择图片");
        if (!confirm(`确定删除选中的 ${selected.length} 张图片吗？`)) return;
        await backup(window.ArchiveApp.state.data, "批量删除图片前").catch(() => {});
        selected.forEach((input) => {
          const city = window.ArchiveApp.state.data.journeys.find((item) => item.id === input.dataset.city);
          if (!city) return;
          if (input.dataset.photo) city.gallery = city.gallery.filter((photo) => photo.id !== input.dataset.photo);
          else if (input.dataset.kind.startsWith("Cover") || input.dataset.kind === "Home Hero") {
            city.coverImage = "";
            city.coverThumb = "";
          } else {
            city.cardImage = "";
            city.cardThumb = "";
          }
        });
        window.ArchiveApp.state.hasUnpublishedChanges = true;
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
        await renderPanel("media");
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
      const journeyView = event.target.closest("[data-journey-view]");
      if (journeyView) {
        closeDashboard();
        window.ArchiveApp.openCity(journeyView.dataset.journeyView);
      }
      const heroKey = event.target.dataset.heroSetting;
      if (heroKey) {
        if (!window.ArchiveApp.state.editMode) return;
        const numeric = ["height", "overlay", "blur", "glow"].includes(heroKey);
        window.ArchiveApp.state.data.site.hero[heroKey] = event.target.type === "checkbox"
          ? event.target.checked
          : numeric
            ? Number(event.target.value)
            : event.target.value;
        const valueLabel = event.target.parentElement?.querySelector(":scope > span");
        if (valueLabel && heroKey === "height") valueLabel.textContent = `${event.target.value}vh`;
        window.ArchiveApp.state.hasUnpublishedChanges = true;
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveManager.scheduleRecovery(window.ArchiveApp.state.data, "修改首页");
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
        updateHeroPreview();
      }
      const settingKey = event.target.dataset.siteSetting;
      if (settingKey) {
        const value = settingKey === "imageQuality" ? Number(event.target.value) : event.target.value;
        window.ArchiveApp.state.data.settings[settingKey] = value;
        if (settingKey === "heroStyle" || settingKey === "defaultBackground") window.ArchiveApp.state.data.site.hero.mode = value;
        window.ArchiveApp.state.hasUnpublishedChanges = true;
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveManager.scheduleRecovery(window.ArchiveApp.state.data, "修改设置");
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
      }
    });
    document.addEventListener("change", async (event) => {
      if (event.target.id !== "heroBackgroundInput" && event.target.id !== "homeCoverInput") return;
      const file = event.target.files?.[0];
      if (file) await window.ArchiveEditor.uploadHeroBackground(file);
      event.target.value = "";
      updateHeroPreview();
    });
  }

  window.ArchiveManager = { bind, openDashboard, refreshDashboard, afterPublish, backup, scheduleRecovery, cancelScheduledRecovery, metrics, sizeLabel, operationProgress, completeOperation, failOperation: failOperationGlass };
})();
