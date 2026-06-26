(function () {
  const CONFIG_KEY = "duomei_cms_worker_url";
  const ADMIN_KEY = "duomei_cms_admin_key";
  const DRAFT_KEY = "duomei_travel_archive_draft_v3";

  function workerUrl() {
    return localStorage.getItem(CONFIG_KEY) || "";
  }

  function setWorkerUrl(url) {
    localStorage.setItem(CONFIG_KEY, url.replace(/\/$/, ""));
  }

  function adminKey() {
    return sessionStorage.getItem(ADMIN_KEY) || "";
  }

  function setAdminKey(value) {
    if (value) sessionStorage.setItem(ADMIN_KEY, value);
    else sessionStorage.removeItem(ADMIN_KEY);
  }

  async function api(path, options = {}) {
    const base = workerUrl();
    if (!base) throw new Error("请先填写 Cloudflare Worker 地址");
    const key = adminKey();
    const response = await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `请求失败：${response.status}`);
    }
    return payload;
  }

  function saveDraft(data) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      data
    }));
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  window.ArchiveCMS = {
    workerUrl,
    setWorkerUrl,
    adminKey,
    setAdminKey,
    api,
    saveDraft,
    loadDraft,
    clearDraft
  };
})();
