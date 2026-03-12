document.addEventListener("DOMContentLoaded", async () => {
  const tokenInput = document.getElementById("tokenInput");
  const enableToggle = document.getElementById("enableToggle");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const rateText = document.getElementById("rateText");
  const toggleShow = document.getElementById("toggleShow");

  // All display toggle checkboxes
  const displayToggles = document.querySelectorAll("[data-key]");

  // ── Load saved settings ───────────────────────────────
  let savedToken = "";
  try {
    const result = await chrome.storage.sync.get(["github_pat", "enabled", "display"]);

    if (result.github_pat) {
      savedToken = result.github_pat;
      tokenInput.value = savedToken;
      saveBtn.disabled = true;
      fetchRateLimit(savedToken);
    }

    if (result.enabled === false) {
      enableToggle.checked = false;
    }

    // Restore display toggles
    if (result.display) {
      for (const toggle of displayToggles) {
        const key = toggle.getAttribute("data-key");
        if (key in result.display) {
          toggle.checked = result.display[key];
        }
      }
    }
  } catch {}

  // ── Sync button state with input ──────────────────────
  tokenInput.addEventListener("input", () => {
    saveBtn.disabled = tokenInput.value.trim() === savedToken;
  });

  // ── Display toggles — save on change ──────────────────
  for (const toggle of displayToggles) {
    toggle.addEventListener("change", async () => {
      const display = {};
      for (const t of displayToggles) {
        display[t.getAttribute("data-key")] = t.checked;
      }
      await chrome.storage.sync.set({ display });
    });
  }

  // ── Toggle show/hide token ────────────────────────────
  toggleShow.addEventListener("click", () => {
    const isPassword = tokenInput.type === "password";
    tokenInput.type = isPassword ? "text" : "password";
    toggleShow.textContent = isPassword ? "🙈" : "👁";
  });

  // ── Enable toggle ─────────────────────────────────────
  enableToggle.addEventListener("change", async () => {
    await chrome.storage.sync.set({ enabled: enableToggle.checked });
    showStatus(
      enableToggle.checked ? "success" : "info",
      enableToggle.checked ? "Enabled. Reload pages to scan." : "Disabled."
    );
  });

  // ── Fetch & display rate limit ────────────────────────
  async function fetchRateLimit(token) {
    rateText.textContent = "Checking…";
    try {
      const res = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const remaining = data.resources.core.remaining;
        const limit = data.resources.core.limit;
        rateText.textContent = `${remaining.toLocaleString()} / ${limit.toLocaleString()} remaining`;
        return { ok: true, remaining, limit };
      } else if (res.status === 401) {
        rateText.textContent = "60 req/hour (no token)";
        return { ok: false, status: 401 };
      } else {
        rateText.textContent = "60 req/hour (no token)";
        return { ok: false, status: res.status };
      }
    } catch (err) {
      rateText.textContent = "60 req/hour (no token)";
      return { ok: false, error: err.message };
    }
  }

  // ── Save token ────────────────────────────────────────
  saveBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();

    if (!token) {
      await chrome.storage.sync.remove("github_pat");
      savedToken = "";
      rateText.textContent = "60 req/hour (no token)";
      saveBtn.disabled = true;
      showStatus("info", "Token removed.");
      return;
    }

    saveBtn.textContent = "Validating…";
    saveBtn.disabled = true;

    const result = await fetchRateLimit(token);

    if (result.ok) {
      await chrome.storage.sync.set({ github_pat: token });
      savedToken = token;
      showStatus("success", `Token saved! ${result.remaining.toLocaleString()} requests remaining.`);
    } else if (result.status === 401) {
      showStatus("error", "Invalid token.");
      saveBtn.disabled = false;
    } else if (result.error) {
      showStatus("error", `Network error: ${result.error}`);
      saveBtn.disabled = false;
    } else {
      showStatus("error", `GitHub API error: ${result.status}`);
      saveBtn.disabled = false;
    }

    saveBtn.textContent = "Save Token";
  });

  // ── Status helper ─────────────────────────────────────
  function showStatus(type, message) {
    status.className = `status ${type}`;
    status.textContent = message;
    setTimeout(() => { status.className = "status"; }, 4000);
  }
});
