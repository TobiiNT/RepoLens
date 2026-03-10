(() => {
  "use strict";

  // ── Config ──────────────────────────────────────────────
  const BATCH_SIZE = 30;
  const BATCH_DELAY_MS = 100;
  const CACHE_TTL_MS = 30 * 60 * 1000;
  const REPO_REGEX = /github\.com\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)/;
  const PROCESSED_ATTR = "data-grc-processed";

  const DEFAULT_DISPLAY = {
    badge_time: true,
    badge_stars: true,
    badge_archived: true,
    tt_description: true,
    tt_last_push: true,
    tt_created: false,
    tt_stars: true,
    tt_forks: true,
    tt_issues: true,
    tt_language: true,
    tt_license: true,
    tt_topics: true,
  };

  let displaySettings = { ...DEFAULT_DISPLAY };

  async function loadDisplaySettings() {
    try {
      const result = await chrome.storage.sync.get("display");
      if (result.display) displaySettings = { ...DEFAULT_DISPLAY, ...result.display };
    } catch {}
  }

  // Live-reload settings
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.display) {
        displaySettings = { ...DEFAULT_DISPLAY, ...changes.display.newValue };
      }
    });
  } catch {}

  // ── Helpers ─────────────────────────────────────────────
  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    const mo = Math.floor(d / 30);
    const y = Math.floor(d / 365);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    if (mo < 12) return `${mo}mo ago`;
    return `${y}y ago`;
  }

  function freshnessLevel(dateStr) {
    const d = (Date.now() - new Date(dateStr).getTime()) / 86400000;
    if (d < 90) return "fresh";
    if (d < 365) return "aging";
    return "stale";
  }

  function fmtK(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
  }

  function fmtDate(s) {
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Cache ───────────────────────────────────────────────
  const mem = new Map();

  async function getCached(key) {
    if (mem.has(key)) {
      const e = mem.get(key);
      if (Date.now() - e.ts < CACHE_TTL_MS) return e.data;
      mem.delete(key);
    }
    try {
      const r = await chrome.storage.local.get(key);
      if (r[key] && Date.now() - r[key].ts < CACHE_TTL_MS) {
        mem.set(key, r[key]);
        return r[key].data;
      }
    } catch {}
    return null;
  }

  async function setCache(key, data) {
    const entry = { data, ts: Date.now() };
    mem.set(key, entry);
    try { await chrome.storage.local.set({ [key]: entry }); } catch {}
  }

  // ── GitHub API ──────────────────────────────────────────
  async function getToken() {
    try {
      const r = await chrome.storage.sync.get("github_pat");
      return r.github_pat || "";
    } catch { return ""; }
  }

  async function fetchRepo(owner, repo, token) {
    const ck = `grc:${owner}/${repo}`;
    const cached = await getCached(ck);
    if (cached) return cached;

    const headers = { Accept: "application/vnd.github.v3+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (res.status === 404) { const d = { notFound: true }; await setCache(ck, d); return d; }
      if (res.status === 403 || res.status === 429) return { rateLimited: true };
      if (!res.ok) return { error: true, status: res.status };

      const j = await res.json();
      const data = {
        pushed_at: j.pushed_at,
        created_at: j.created_at,
        stargazers_count: j.stargazers_count,
        forks_count: j.forks_count,
        open_issues_count: j.open_issues_count,
        archived: j.archived,
        description: j.description || "",
        full_name: j.full_name,
        language: j.language,
        license: j.license?.spdx_id || j.license?.name || null,
        topics: j.topics || [],
      };
      await setCache(ck, data);
      return data;
    } catch (err) {
      return { error: true, message: err.message };
    }
  }

  // ── Badge & Tooltip ─────────────────────────────────────
  function createBadge(data) {
    const s = displaySettings;
    const el = document.createElement("span");
    el.className = "grc-badge";

    // Error states
    if (data.notFound) { el.classList.add("grc-not-found"); el.textContent = "404"; el.title = "Repository not found"; return el; }
    if (data.rateLimited) { el.classList.add("grc-rate-limited"); el.textContent = "⏳"; el.title = "Rate limited — add token in settings"; return el; }
    if (data.error) { el.classList.add("grc-error"); el.textContent = "⚠"; el.title = "Failed to fetch"; return el; }

    // Archived
    if (data.archived) {
      el.classList.add("grc-archived");
      if (s.badge_archived) el.innerHTML = `<span class="grc-label">archived</span>`;
    } else {
      const level = freshnessLevel(data.pushed_at);
      el.classList.add(`grc-${level}`);
      if (s.badge_time) el.innerHTML = `<span class="grc-time">${timeAgo(data.pushed_at)}</span>`;
    }

    // Stars on badge
    if (s.badge_stars) {
      const sp = document.createElement("span");
      sp.className = "grc-stars";
      sp.textContent = `★ ${fmtK(data.stargazers_count)}`;
      el.appendChild(sp);
    }

    // Tooltip
    const tt = document.createElement("div");
    tt.className = "grc-tooltip";
    tt.innerHTML = buildTooltip(data);
    el.appendChild(tt);

    return el;
  }

  function buildTooltip(data) {
    const s = displaySettings;
    const L = [];

    L.push(`<div class="grc-tt-header">${esc(data.full_name)}</div>`);

    if (s.tt_description && data.description)
      L.push(`<div class="grc-tt-desc">${esc(data.description)}</div>`);

    if (s.tt_topics && data.topics && data.topics.length > 0) {
      const tags = data.topics.slice(0, 8).map(t => `<span class="grc-tt-topic">${esc(t)}</span>`).join("");
      L.push(`<div class="grc-tt-topics">${tags}</div>`);
    }

    L.push(`<div class="grc-tt-divider"></div>`);

    const row = (label, val) => `<div class="grc-tt-row"><span>${label}</span><span>${val}</span></div>`;

    if (s.tt_last_push)
      L.push(row("Last push:", `${fmtDate(data.pushed_at)} (${timeAgo(data.pushed_at)})`));
    if (s.tt_created)
      L.push(row("Created:", fmtDate(data.created_at)));
    if (s.tt_stars)
      L.push(row("Stars:", `★ ${data.stargazers_count.toLocaleString()}`));
    if (s.tt_forks)
      L.push(row("Forks:", `🍴 ${data.forks_count.toLocaleString()}`));
    if (s.tt_issues)
      L.push(row("Open issues:", data.open_issues_count.toLocaleString()));
    if (s.tt_language && data.language)
      L.push(row("Language:", esc(data.language)));
    if (s.tt_license && data.license)
      L.push(row("License:", esc(data.license)));
    if (data.archived)
      L.push(`<div class="grc-tt-archived">⚫ This repository is archived</div>`);

    return L.join("");
  }

  // ── Scan & Process ──────────────────────────────────────
  function extractRepoLinks() {
    const links = document.querySelectorAll(`a[href*="github.com"]:not([${PROCESSED_ATTR}])`);
    const results = [];
    const skipOwners = new Set([
      "topics","explore","settings","notifications","pulls","issues",
      "marketplace","sponsors","orgs","users","features","security",
      "pricing","enterprise","login","join","about","collections",
      "events","customer-stories",
    ]);

    for (const link of links) {
      const match = link.href.match(REPO_REGEX);
      if (!match) continue;
      let [, owner, repo] = match;
      repo = repo.replace(/\.git$/, "").split("/")[0].split("#")[0].split("?")[0];
      if (skipOwners.has(owner.toLowerCase()) || !repo) continue;
      link.setAttribute(PROCESSED_ATTR, "1");
      results.push({ link, owner, repo });
    }
    return results;
  }

  async function processPage() {
    const entries = extractRepoLinks();
    if (!entries.length) return;
    const token = await getToken();

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(({ link, owner, repo }) =>
        fetchRepo(owner, repo, token).then(data => {
          if (!data) return;
          link.parentNode.insertBefore(createBadge(data), link.nextSibling);
        })
      ));
      if (i + BATCH_SIZE < entries.length)
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ── Init ────────────────────────────────────────────────
  async function init() {
    try {
      const r = await chrome.storage.sync.get("enabled");
      if (r.enabled === false) return;
    } catch {}

    await loadDisplaySettings();
    await processPage();

    const observer = new MutationObserver(mutations => {
      let found = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && (n.matches?.("a[href*='github.com']") || n.querySelector?.("a[href*='github.com']"))) {
            found = true; break;
          }
        }
        if (found) break;
      }
      if (found) {
        clearTimeout(observer._t);
        observer._t = setTimeout(processPage, 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
