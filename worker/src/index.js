const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400"
  };
}

function adminEmail(request) {
  return request.headers.get("cf-access-authenticated-user-email") || "";
}

function adminKey(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function assertAdmin(request, env) {
  const email = adminEmail(request);
  const admins = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (email && admins.includes(email.toLowerCase())) {
    return email;
  }

  const key = adminKey(request);
  if (env.ADMIN_KEY && key && key === env.ADMIN_KEY) {
    return "admin-key";
  }

  throw Object.assign(new Error("Unauthorized"), { status: 401 });
}

function isAdmin(request, env) {
  try {
    return { ok: true, actor: assertAdmin(request, env) };
  } catch {
    return { ok: false, actor: null };
  }
}

function github(env, path, init = {}) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "duomei-travel-journal-worker",
      ...(init.headers || {})
    }
  });
}

async function readJsonFile(env, path, fallback) {
  const branch = env.GITHUB_BRANCH || "main";
  const response = await github(env, `/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
  if (response.status === 404) return fallback;
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  const payload = await response.json();
  const text = atob(payload.content.replace(/\n/g, ""));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(text, (char) => char.charCodeAt(0))));
}

async function currentHead(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const ref = await github(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
  if (!ref.ok) throw new Error(`Cannot read branch ref: ${ref.status}`);
  const refJson = await ref.json();
  const commit = await github(env, `/git/commits/${refJson.object.sha}`);
  if (!commit.ok) throw new Error(`Cannot read commit: ${commit.status}`);
  return { ref: refJson, commit: await commit.json() };
}

async function createBlob(env, content, encoding = "utf-8") {
  const response = await github(env, "/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content, encoding })
  });
  if (!response.ok) throw new Error(`Cannot create blob: ${response.status}`);
  return response.json();
}

async function publishArchive(request, env) {
  const actor = assertAdmin(request, env);
  const body = await request.json();
  const message = String(body.message || "").trim() || "Update Travel Journal";
  const archive = body.archive;
  if (!archive || typeof archive !== "object") {
    return json({ ok: false, error: "Missing archive payload" }, 400, corsHeaders(request, env));
  }

  const now = new Date().toISOString();
  const versions = await readJsonFile(env, "dist/content/versions.json", []);
  const nextVersion = {
    id: `version-${Date.now()}`,
    createdAt: now,
    actor,
    message,
    summary: body.summary || message
  };

  const files = {
    "dist/content/journeys.json": archive.journeys || [],
    "dist/content/settings.json": archive.site ? { site: archive.site, settings: archive.settings || {} } : archive.settings || {},
    "dist/content/tags.json": collectTags(archive.journeys || []),
    "dist/content/versions.json": [nextVersion, ...versions].slice(0, 100)
  };

  const { ref, commit } = await currentHead(env);
  const treeEntries = [];
  for (const [path, value] of Object.entries(files)) {
    const blob = await createBlob(env, JSON.stringify(value, null, 2));
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const treeResponse = await github(env, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: commit.tree.sha,
      tree: treeEntries
    })
  });
  if (!treeResponse.ok) throw new Error(`Cannot create tree: ${treeResponse.status}`);
  const tree = await treeResponse.json();

  const commitResponse = await github(env, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [ref.object.sha]
    })
  });
  if (!commitResponse.ok) throw new Error(`Cannot create commit: ${commitResponse.status}`);
  const nextCommit = await commitResponse.json();

  const updateResponse = await github(env, `/git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH || "main")}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: nextCommit.sha })
  });
  if (!updateResponse.ok) throw new Error(`Cannot update branch: ${updateResponse.status}`);

  return json({ ok: true, commit: nextCommit.sha, version: nextVersion }, 200, corsHeaders(request, env));
}

function collectTags(journeys) {
  const counts = {};
  for (const journey of journeys) {
    for (const tag of journey.tags || []) counts[tag] = (counts[tag] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function handle(request, env) {
  const headers = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { headers });

  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/health") {
      const admin = isAdmin(request, env);
      return json({ ok: true, admin: admin.ok, actor: admin.actor }, 200, headers);
    }
    if (url.pathname === "/api/archive" && request.method === "GET") {
      return json({
        ok: true,
        journeys: await readJsonFile(env, "dist/content/journeys.json", []),
        settings: await readJsonFile(env, "dist/content/settings.json", {}),
        tags: await readJsonFile(env, "dist/content/tags.json", []),
        versions: await readJsonFile(env, "dist/content/versions.json", [])
      }, 200, headers);
    }
    if (url.pathname === "/api/publish" && request.method === "POST") {
      return publishArchive(request, env);
    }
    return json({ ok: false, error: "Not found" }, 404, headers);
  } catch (error) {
    return json({ ok: false, error: error.message || "Worker error" }, error.status || 500, headers);
  }
}

export default { fetch: handle };
