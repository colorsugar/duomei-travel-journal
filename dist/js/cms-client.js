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
    const timeoutMs = options.timeoutMs || 180000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal,
        headers
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `请求失败：${response.status}`);
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("发布超时：后台超过 3 分钟没有响应，请检查 GitHub 是否已有新 commit。");
      }
      if (error instanceof SyntaxError) {
        throw new Error("后台返回的不是 JSON，请检查 Worker 是否正常。");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function saveDraft(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: window.ArchiveStore.compactForLocalStorage(data)
      }));
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
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
