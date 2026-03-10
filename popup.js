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
  try {
    const result = await chrome.storage.sync.get(["github_pat", "enabled", "display"]);

    if (result.github_pat) {
      tokenInput.value = result.github_pat;
      rateText.textContent = "5,000 req/hour (authenticated)";
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

  // ── Save token ────────────────────────────────────────
  saveBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();

    if (!token) {
      await chrome.storage.sync.remove("github_pat");
      rateText.textContent = "60 req/hour (no token)";
      showStatus("info", "Token removed.");
      return;
    }

    saveBtn.textContent = "Validating...";
    saveBtn.disabled = true;

    try {
      const res = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const remaining = data.resources.core.remaining;
        const limit = data.resources.core.limit;
        await chrome.storage.sync.set({ github_pat: token });
        rateText.textContent = `${remaining.toLocaleString()} / ${limit.toLocaleString()} remaining`;
        showStatus("success", `Token saved! ${remaining.toLocaleString()} requests remaining.`);
      } else if (res.status === 401) {
        showStatus("error", "Invalid token.");
      } else {
        showStatus("error", `GitHub API error: ${res.status}`);
      }
    } catch (err) {
      showStatus("error", `Network error: ${err.message}`);
    }

    saveBtn.textContent = "Save Token";
    saveBtn.disabled = false;
  });

  // ── Status helper ─────────────────────────────────────
  function showStatus(type, message) {
    status.className = `status ${type}`;
    status.textContent = message;
    setTimeout(() => { status.className = "status"; }, 4000);
  }
});
