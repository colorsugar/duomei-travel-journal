(function () {
  const $ = (selector, root = document) => root.querySelector(selector);

  let logoPressTimer = 0;
  let publishing = false;
  let autoSaveTimer = 0;

  function toast(message) {
    window.ArchiveUI?.toast(message);
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
    toast("管理员已登录");
    closeDialog();
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

  async function publish() {
    if (publishing) return;
    if (!document.body.classList.contains("admin-authenticated")) {
      openDialog();
      return;
    }

    const message = prompt("发布说明 / Commit Message", "Update Travel Journal");
    if (!message) return;

    const button = $("#adminPublish");
    setPublishing(button, true);
    window.ArchiveCMS.saveDraft(window.ArchiveApp.state.data);

    try {
      if (window.ArchiveManager) {
        await window.ArchiveManager.backup(window.ArchiveApp.state.data, "发布前自动备份").catch(() => {});
      }
      toast("正在发布到 GitHub...");
      const archive = window.ArchiveStore.normalize(window.ArchiveApp.state.data);
      const result = await window.ArchiveCMS.api("/api/publish", {
        method: "POST",
        timeoutMs: 180000,
        body: JSON.stringify({ message, summary: message, archive })
      });

      if (!result?.ok || !result.commit) {
        throw new Error("发布没有返回 commit，草稿已保留");
      }

      if (result.archive) {
        window.ArchiveApp.state.data = window.ArchiveStore.normalize(result.archive);
        window.ArchiveStore.save(window.ArchiveApp.state.data, true);
        window.ArchiveRender.renderApp(window.ArchiveApp.state);
      }

      window.ArchiveCMS.clearDraft();
      window.ArchiveApp.state.hasUnpublishedChanges = false;
      toast(`发布成功：${result.commit.slice(0, 7)}${result.uploads ? `，图片 ${result.uploads} 张` : ""}`);
    } catch (error) {
      toast(error.message || "发布失败，草稿已保留");
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
    window.ArchiveManager?.backup(window.ArchiveApp.state.data, "30 秒自动保存")?.catch(() => {});
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
    $("#adminEntry")?.addEventListener("click", openDialog);
    $("#adminConnect")?.addEventListener("click", async () => {
      const url = $("#workerUrl").value.trim();
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
        toast(error.message || "连接后台失败");
      }
    });
    $("#adminEdit")?.addEventListener("click", enableEdit);
    $("#adminPublish")?.addEventListener("click", () => publish().catch(() => {}));
    $("#adminRestoreDraft")?.addEventListener("click", restoreDraft);
    $("#adminLogout")?.addEventListener("click", logoutAdmin);
    $("#adminClose")?.addEventListener("click", closeDialog);
    bindLogoSecret();
    bindAutoSave();

    if (location.hash === "#admin" || location.pathname.endsWith("/admin")) {
      setTimeout(openDialog, 250);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
