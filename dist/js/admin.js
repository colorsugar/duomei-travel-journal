(function () {
  const $ = (selector, root = document) => root.querySelector(selector);

  let logoClicks = 0;
  let logoTimer = 0;

  function toast(message) {
    window.ArchiveUI?.toast(message);
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
    if (!health.admin) throw new Error("后台已连接，但管理员密钥不正确");
    document.body.classList.add("admin-authenticated");
    toast(`管理员已登录：${health.actor || "admin"}`);
    closeDialog();
    return health;
  }

  function enableEdit() {
    if (!document.body.classList.contains("admin-authenticated")) {
      openDialog();
      return;
    }
    $("#editToggle")?.click();
  }

  async function publish() {
    if (!document.body.classList.contains("admin-authenticated")) {
      openDialog();
      return;
    }
    const message = prompt("发布说明 / Commit Message", "Update Travel Journal");
    if (!message) return;
    window.ArchiveCMS.saveDraft(window.ArchiveApp.state.data);
    toast("正在发布到 GitHub...");
    const result = await window.ArchiveCMS.api("/api/publish", {
      method: "POST",
      body: JSON.stringify({
        message,
        summary: message,
        archive: window.ArchiveApp.state.data
      })
    });
    window.ArchiveCMS.clearDraft();
    toast(`发布成功：${result.commit.slice(0, 7)}`);
  }

  function restoreDraft() {
    const draft = window.ArchiveCMS.loadDraft();
    if (!draft) {
      toast("没有本地草稿");
      return;
    }
    if (!confirm(`恢复 ${new Date(draft.savedAt).toLocaleString()} 的草稿吗？`)) return;
    window.ArchiveApp.state.data = draft.data;
    window.ArchiveStore.save(draft.data, true);
    window.ArchiveRender.renderApp(window.ArchiveApp.state);
    toast("草稿已恢复");
  }

  function bindLogoSecret() {
    $(".brand")?.addEventListener("click", () => {
      logoClicks += 1;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => { logoClicks = 0; }, 1600);
      if (logoClicks >= 5) {
        logoClicks = 0;
        openDialog();
      }
    });
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
        toast(error.message);
      }
    });
    $("#adminEdit")?.addEventListener("click", enableEdit);
    $("#adminPublish")?.addEventListener("click", () => publish().catch((error) => toast(error.message)));
    $("#adminRestoreDraft")?.addEventListener("click", restoreDraft);
    $("#adminClose")?.addEventListener("click", closeDialog);
    bindLogoSecret();

    if (location.hash === "#admin" || location.pathname.endsWith("/admin")) {
      setTimeout(openDialog, 250);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
