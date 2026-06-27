(function () {
  const CONFIG_KEY = "duomei_cms_worker_url";
  const ADMIN_KEY = "duomei_cms_admin_key";
  const DRAFT_KEY = "duomei_travel_archive_draft_v3";
  const DEFAULT_WORKER_URL = "https://duomei-travel-journal-admin.colorsugar.workers.dev";

  function workerUrl() {
    return localStorage.getItem(CONFIG_KEY) || DEFAULT_WORKER_URL;
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
    if (!base) {
      const error = new Error("请先填写 Cloudflare Worker 地址");
      error.code = "WORKER_URL_MISSING";
      throw error;
    }

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
        headers,
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer"
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok || payload.ok === false) {
        const error = new Error(payload.error || `请求失败：${response.status}`);
        error.code = "WORKER_RESPONSE";
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("后台在限定时间内没有响应");
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      if (error instanceof SyntaxError) {
        const parseError = new Error("后台返回了无法识别的数据");
        parseError.code = "INVALID_RESPONSE";
        throw parseError;
      }
      if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error.message || "")) {
        const networkError = new Error("浏览器无法连接 Cloudflare Worker");
        networkError.code = "NETWORK";
        throw networkError;
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
