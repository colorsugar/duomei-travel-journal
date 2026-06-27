(function () {
  const $ = (selector, root = document) => root.querySelector(selector);

  let logoPressTimer = 0;
  let publishing = false;
  let autoSaveTimer = 0;
  let lastPublishMessage = "";

  function toast(message) {
    window.ArchiveUI?.toast(message);
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || "");
    if (/unexpected end of json input|invalid_response|无法识别的数据/i.test(raw)) return "线上数据暂时还没同步完成，请稍后刷新或重试。";
    if (/failed to fetch|networkerror|load failed|浏览器无法连接/i.test(raw)) return "无法连接发布服务，请检查网络后重试。";
    if (/cloudflare worker/i.test(raw)) return "无法连接 Cloudflare Worker，请确认 Worker 地址可访问。";
    return raw || "未知错误";
  }

  function setAdminStatus(text) {
    const status = $("#adminStatus");
    if (status) status.textContent = text;
  }

  function openDialog() {
    const dialog = $("#adminDialog");
    $("#workerUrl").value = window.ArchiveCMS.workerUrl();
    $("#adminKey").value = window.ArchiveCMS.adminKey();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    window.setTimeout(() => $("#adminId")?.focus(), 60);
  }

  function closeDialog() {
    const dialog = $("#adminDialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function checkAdmin() {
    const health = await window.ArchiveCMS.api("/api/health");
    if (!health.admin) throw new Error("后台已连接，但当前账号不是管理员");
    document.body.classList.add("admin-authenticated");
    setAdminStatus(`后台已连接${health.actor ? ` · ${health.actor}` : ""}`);
    await reconcileRemoteAfterLogin().catch(() => {});
    toast("管理员已登录");
    closeDialog();
    window.ArchiveRender?.renderApp(window.ArchiveApp.state);
    window.ArchiveManager?.openDashboard();
    return health;
  }

  function enableEdit() {
    if (!document.body.classList.contains("admin-authenticated")) {
      openDialog();
      return;
    }
    $("#editToggle")?.click();
  }

  function logoutAdmin() {
    document.body.classList.remove("admin-authenticated", "edit-on");
    window.ArchiveCMS.setAdminKey("");
    if (window.ArchiveApp?.state) {
      window.ArchiveApp.state.editMode = false;
      window.ArchiveRender.setEditable(false);
      window.ArchiveRender.renderApp(window.ArchiveApp.state);
    }
    setAdminStatus("后台已断开");
    toast("已退出管理");
  }

  function setPublishing(button, enabled) {
    publishing = enabled;
    if (!button) return;
    button.disabled = enabled;
    if (enabled) {
      button.dataset.originalText = button.textContent;
      button.textContent = "发布中...";
      button.classList.add("is-loading");
    } else {
      button.textContent = button.dataset.originalText || "发布";
      button.classList.remove("is-loading");
    }
  }

  function publishFailure(error, stage) {
    const reason = friendlyError(error);
    const suggestions = {
      NETWORK: "检查网络和 Worker 地址，然后点击“重试发布”。iPhone Safari 可切换一次网络后重试。",
      TIMEOUT: "先查看 GitHub 是否已经生成 Commit；若没有，可安全重试。",
      INVALID_RESPONSE: "确认 Worker 已部署且地址正确，然后重试。",
      WORKER_RESPONSE: "后台拒绝了请求，请根据上方原因检查图片大小或仓库权限。",
      WORKER_URL_MISSING: "重新打开登录窗口并填写 Cloudflare Worker 地址。"
    };
    const suggestion = suggestions[error?.code] || "草稿已经保留，可稍后重试；不会丢失本次修改。";
    const message = `发布失败\n阶段：${stage}\n原因：${reason}\n建议：${suggestion}`;
    const safe = (value) => String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    window.ArchiveManager?.failOperation(message);
    const panel = $("#uploadProgressItems");
    if (panel) {
      panel.innerHTML = `
        <article class="publish-failure">
          <strong>发布失败</strong>
          <span>阶段：${safe(stage)}</span>
          <span>原因：${safe(reason)}</span>
          <span>建议：${safe(suggestion)}</span>
          <button type="button" id="retryPublish">重试发布</button>
        </article>`;
      $("#uploadProgress")?.removeAttribute("hidden");
      $("#retryPublish")?.addEventListener("click", () => publish(lastPublishMessage, true).catch(() => {}), { once: true });
    }
    toast(`发布失败：${reason}`);
  }

  function archiveFingerprint(archive) {
    return JSON.stringify({
      site: {
        title: archive?.site?.title,
        subtitle: archive?.site?.subtitle,
        poem: archive?.site?.poem,
        journeyEyebrow: archive?.site?.journeyEyebrow,
        journeyTitle: archive?.site?.journeyTitle,
        journeyDescription: archive?.site?.journeyDescription,
        hero: archive?.site?.hero,
        homeSections: archive?.site?.homeSections
      },
      settings: archive?.settings,
      journeys: (archive?.journeys || []).map((city) => ({
        slug: city.slug,
        title: city.title,
        updated: city.updated,
        coverImage: city.coverImage,
        gallery: (city.gallery || []).map((photo) => photo.src)
      }))
    });
  }

  async function parsePagesJson(response, label) {
    if (!response?.ok) {
      const error = new Error(`${label} Pages data is not ready`);
      error.code = "PAGES_NOT_READY";
      throw error;
    }
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[")) || /<html|<!doctype/i.test(trimmed)) {
      const error = new Error(`${label} Pages JSON is not ready`);
      error.code = "PAGES_NOT_READY";
      throw error;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      const error = new Error(`${label} Pages JSON is not ready`);
      error.code = "PAGES_NOT_READY";
      throw error;
    }
  }

  async function fetchPagesArchive() {
    const bust = Date.now();
    const [journeysResponse, settingsResponse] = await Promise.all([
      fetch(`./content/journeys.json?deploy=${bust}`, { cache: "no-store" }),
      fetch(`./content/settings.json?deploy=${bust}`, { cache: "no-store" })
    ]);
    const journeys = await parsePagesJson(journeysResponse, "journeys.json");
    const settings = await parsePagesJson(settingsResponse, "settings.json");
    return { journeys, site: settings.site, settings: settings.settings };
  }

  async function waitForPages(expectedArchive) {
    const expected = archiveFingerprint(expectedArchive);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const live = await fetchPagesArchive();
        if (archiveFingerprint(live) === expected) return true;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return false;
  }

  function hasEmbeddedImages(archive) {
    return (archive?.journeys || []).some((city) =>
      [city.coverImage, city.coverThumb, city.cardImage, city.cardThumb, ...(city.gallery || []).flatMap((photo) => [photo.src, photo.thumb])]
        .some((value) => typeof value === "string" && (value.startsWith("data:") || value.startsWith("blob:")))
    );
  }

  async function reconcileRemoteAfterLogin() {
    const response = await window.ArchiveCMS.api("/api/archive", { timeoutMs: 30000 });
    const remote = window.ArchiveStore.normalize({
      site: response.settings?.site || {},
      settings: response.settings?.settings || {},
      journeys: response.journeys || []
    });
    const local = window.ArchiveStore.normalize(window.ArchiveApp.state.data);
    const remoteMatchesLocal = archiveFingerprint(remote) === archiveFingerprint(local);
    const localLooksClean = !window.ArchiveApp.state.hasUnpublishedChanges && !hasEmbeddedImages(local);
    if (remoteMatchesLocal || localLooksClean) {
      window.ArchiveApp.state.data = remote;
      window.ArchiveApp.state.hasUnpublishedChanges = false;
      window.ArchiveStore.save(remote, true);
      window.ArchiveCMS.clearDraft();
      localStorage.setItem("duomei_publish_state", JSON.stringify({
        state: "published",
        savedAt: new Date().toISOString(),
        commit: ""
      }));
      window.ArchiveManager?.clearOperationFailure?.();
      $("#toast")?.classList.remove("show");
    }
  }

  async function canonicalArchive(resultArchive) {
    if (resultArchive && !hasEmbeddedImages(resultArchive)) return resultArchive;
    const response = await window.ArchiveCMS.api("/api/archive", { timeoutMs: 30000 });
    return {
      site: response.settings?.site || {},
      settings: response.settings?.settings || {},
      journeys: response.journeys || []
    };
  }

  function validateArchive(archive) {
    const normalized = window.ArchiveStore.normalize(archive);
    JSON.parse(JSON.stringify({
      settings: { site: normalized.site, settings: normalized.settings },
      journeys: normalized.journeys
    }));
    if (!Array.isArray(normalized.journeys)) throw new Error("Journey 数据不是有效列表");
    return normalized;
  }

  async function publish(previousMessage = "", isRetry = false) {
    if (publishing) return;
    if (!document.body.classList.contains("admin-authenticated")) {
      openDialog();
      return;
    }

    const fallbackMessage = previousMessage || "Update Travel Journal";
    let message = fallbackMessage;
    if (!isRetry && typeof window.prompt === "function") {
      try {
        message = window.prompt("发布说明 / Commit Message", fallbackMessage) || fallbackMessage;
      } catch {
        message = fallbackMessage;
      }
    }
    if (!message) return;
    lastPublishMessage = message;

    const button = $("#adminPublish");
    setPublishing(button, true);
    window.ArchiveCMS.saveDraft(window.ArchiveApp.state.data);
    const publishStages = [
      "整理待发布图片",
      "更新 Journey JSON",
      "上传到 GitHub 并创建 Commit",
      "等待 GitHub Pages",
      "发布完成"
    ];

    let currentStage = "准备发布";
    try {
      window.ArchiveManager?.operationProgress(publishStages, 0, "准备发布");
      if (window.ArchiveManager) {
        window.ArchiveManager.cancelScheduledRecovery();
        await window.ArchiveManager.backup(window.ArchiveApp.state.data, "发布前自动备份").catch(() => {});
      }
      currentStage = "更新 Journey JSON";
      window.ArchiveManager?.operationProgress(publishStages, 1, "正在更新 JSON");
      toast("正在发布到 GitHub...");
      const archive = validateArchive(window.ArchiveApp.state.data);
      toast("JSON 校验通过，正在发布...");
      currentStage = "连接 Cloudflare Worker 并上传 GitHub";
      window.ArchiveManager?.operationProgress(publishStages, 2, "GitHub 正在处理");
      const result = await window.ArchiveCMS.api("/api/publish", {
        method: "POST",
        timeoutMs: 180000,
        body: JSON.stringify({ message, summary: message, archive })
      });

      if (!result?.ok || !result.commit) {
        throw new Error("发布没有返回 commit，草稿已保留");
      }

      localStorage.setItem("duomei_publish_state", JSON.stringify({
        state: "commit-success",
        savedAt: new Date().toISOString(),
        commit: result.commit
      }));
      currentStage = "读取发布后的数据";
      let syncedArchive = result.archive || archive;
      try {
        syncedArchive = await canonicalArchive(result.archive);
      } catch (syncError) {
        window.ArchiveUI?.notify?.(`Commit 已创建，但线上 JSON 仍在同步：${friendlyError(syncError)}`, "normal", "Waiting for Pages");
      }
      window.ArchiveApp.state.data = window.ArchiveStore.normalize(syncedArchive);
      window.ArchiveStore.save(window.ArchiveApp.state.data, true);
      window.ArchiveRender.renderApp(window.ArchiveApp.state);
      window.ArchiveCMS.clearDraft();
      window.ArchiveApp.state.hasUnpublishedChanges = false;
      localStorage.setItem("duomei_last_publish", JSON.stringify({
        savedAt: new Date().toISOString(),
        commit: result.commit,
        status: "waiting-pages"
      }));
      await window.ArchiveManager?.afterPublish("waiting-pages");

      window.ArchiveManager?.operationProgress(publishStages, 3, "Commit 已创建，等待 Pages");
      currentStage = "等待 GitHub Pages 更新";
      let pagesReady = false;
      try {
        pagesReady = await waitForPages(syncedArchive);
      } catch {
        pagesReady = false;
      }
      if (pagesReady) {
        let liveArchive = syncedArchive;
        try {
          liveArchive = await fetchPagesArchive();
        } catch {
          liveArchive = syncedArchive;
        }
        window.ArchiveApp.state.data = window.ArchiveStore.normalize(liveArchive);
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
        await window.ArchiveManager?.afterPublish("published");
        window.ArchiveManager?.operationProgress(publishStages, 4, "网站已经更新");
        window.ArchiveManager?.completeOperation("发布完成");
        toast(`发布成功：${result.commit.slice(0, 7)}${result.uploads ? `，图片 ${result.uploads} 张` : ""}`);
      } else {
        window.ArchiveManager?.completeOperation("已提交成功，正在等待线上数据同步");
        toast(`Commit ${result.commit.slice(0, 7)} 已完成，GitHub Pages 仍在部署`);
      }
    } catch (error) {
      if (/PAGES_NOT_READY/i.test(error?.code || "")) {
        window.ArchiveManager?.completeOperation("已提交成功，正在等待线上数据同步");
        return;
      }
      publishFailure(error, currentStage);
      throw error;
    } finally {
      setPublishing(button, false);
    }
  }

  function restoreDraft() {
    const draft = window.ArchiveCMS.loadDraft();
    if (!draft) {
      toast("没有本地草稿");
      return;
    }
    if (!confirm(`恢复 ${new Date(draft.savedAt).toLocaleString()} 的草稿吗？`)) return;
    window.ArchiveApp.state.data = window.ArchiveStore.normalize(draft.data);
    window.ArchiveStore.save(window.ArchiveApp.state.data, true);
    window.ArchiveRender.renderApp(window.ArchiveApp.state);
    toast("草稿已恢复");
  }

  function saveDraftSilently() {
    if (!document.body.classList.contains("admin-authenticated")) return;
    if (!window.ArchiveApp?.state?.data) return;
    window.ArchiveCMS.saveDraft(window.ArchiveApp.state.data);
    setAdminStatus("草稿已自动保存");
  }

  function bindAutoSave() {
    clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(saveDraftSilently, 30000);
    window.addEventListener("beforeunload", saveDraftSilently);
    window.addEventListener("beforeunload", (event) => {
      if (!window.ArchiveApp?.state?.hasUnpublishedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveDraftSilently();
    });
  }

  function bindLogoSecret() {
    const brand = $(".brand");
    if (!brand) return;
    const start = (event) => {
      if (document.body.classList.contains("admin-authenticated")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clearTimeout(logoPressTimer);
      logoPressTimer = window.setTimeout(() => {
        logoPressTimer = 0;
        if (navigator.vibrate) navigator.vibrate(20);
        openDialog();
      }, 850);
    };
    const cancel = () => {
      if (logoPressTimer) clearTimeout(logoPressTimer);
      logoPressTimer = 0;
    };
    brand.addEventListener("pointerdown", start);
    brand.addEventListener("pointerup", cancel);
    brand.addEventListener("pointercancel", cancel);
    brand.addEventListener("pointerleave", cancel);
    brand.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  function bind() {
    const publishButton = $("#adminPublish");
    $("#adminEntry")?.addEventListener("click", () => {
      if (document.body.classList.contains("admin-authenticated")) window.ArchiveManager?.openDashboard();
      else openDialog();
    });
    $("#uploadProgressClose")?.addEventListener("click", () => {
      const panel = $("#uploadProgress");
      if (panel) panel.hidden = true;
      window.ArchiveManager?.clearOperationFailure?.();
    });
    $("#adminConnect")?.addEventListener("click", async () => {
      const url = $("#workerUrl").value.trim() || window.ArchiveCMS.workerUrl();
      const key = $("#adminKey").value.trim();
      if (!url) {
        toast("请填写 Worker 地址");
        return;
      }
      if (!key) {
        toast("请填写管理员密钥");
        return;
      }
      window.ArchiveCMS.setWorkerUrl(url);
      window.ArchiveCMS.setAdminKey(key);
      try {
        await checkAdmin();
      } catch (error) {
        toast(friendlyError(error) || "连接后台失败");
      }
    });
    $("#adminEdit")?.addEventListener("click", enableEdit);
    if (publishButton) {
      publishButton.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        publish().catch(() => {});
      };
    }
    document.addEventListener("click", (event) => {
      if (event.target.closest("#adminPublish")) {
        event.preventDefault();
        event.stopPropagation();
        publish().catch(() => {});
      }
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest("#adminPublish")) {
        event.preventDefault();
        event.stopPropagation();
        publish().catch(() => {});
      }
    }, true);
    $("#adminRestoreDraft")?.addEventListener("click", restoreDraft);
    $("#adminLogout")?.addEventListener("click", logoutAdmin);
    $("#adminClose")?.addEventListener("click", closeDialog);
    $("#adminDialog")?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        $("#adminConnect")?.click();
      }
    });
    bindLogoSecret();
    bindAutoSave();

    if (location.hash === "#admin" || location.pathname.endsWith("/admin")) {
      setTimeout(openDialog, 250);
    }
  }

  window.ArchiveAdmin = { publish, openDialog, checkAdmin };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
