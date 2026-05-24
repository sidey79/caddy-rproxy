function buildServiceUrl(subdomain, path = "") {
  const host = window.location.hostname;
  const baseHost = host.replace(/^landing\./, "");
  const normalizedPath = path || "";

  if (!subdomain || !baseHost || baseHost === host) {
    return normalizedPath || "/";
  }

  return `https://${subdomain}.${baseHost}${normalizedPath}`;
}

function getPreferredTheme() {
  const storedTheme = window.localStorage.getItem("landing-theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  root.dataset.theme = theme;

  if (themeToggle) {
    const darkActive = theme === "dark";
    themeToggle.setAttribute("aria-pressed", darkActive ? "true" : "false");
    themeToggle.querySelector(".theme-toggle-label").textContent = darkActive ? "Hellmodus" : "Darkmode";
  }
}

function initializeThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  applyTheme(getPreferredTheme());

  if (!themeToggle) {
    return;
  }

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("landing-theme", nextTheme);
    applyTheme(nextTheme);
  });
}

function hydrateLinks() {
  const links = document.querySelectorAll("[data-subdomain]");
  links.forEach((link) => {
    const subdomain = link.getAttribute("data-subdomain");
    const path = link.getAttribute("data-path") || "";
    link.href = buildServiceUrl(subdomain, path);
  });
}

function renderIdentity(profile) {
  const identityName = document.getElementById("identity-name");
  const identityMeta = document.getElementById("identity-meta");
  const rolePill = document.getElementById("role-pill");
  const adminSection = document.getElementById("admin-section");

  const displayName = profile.name || profile.user || "Unbekannt";
  const groups = Array.isArray(profile.groups) ? profile.groups : [];
  const role = profile.role || "family";

  identityName.textContent = displayName;
  identityMeta.textContent = [profile.email || "ohne Mailadresse", groups.join(", ") || "ohne Gruppen"]
    .filter(Boolean)
    .join(" • ");
  rolePill.textContent = role;

  if (role === "admin" || groups.includes("admin") || groups.includes("admins")) {
    adminSection.hidden = false;
  }
}

function renderFallback(error) {
  const identityName = document.getElementById("identity-name");
  const identityMeta = document.getElementById("identity-meta");
  const rolePill = document.getElementById("role-pill");

  identityName.textContent = "Profil nicht verfuegbar";
  identityMeta.textContent = `Die Personalisierung konnte nicht geladen werden: ${error}`;
  rolePill.textContent = "family";
}

function mapStatusLabel(status) {
  const map = {
    ok: "Backup OK",
    warn: "Backup mit Warnungen",
    error: "Backup fehlgeschlagen",
    unknown: "Backupstatus unbekannt",
  };
  return map[status] || map.unknown;
}

function formatTimestamp(value) {
  if (!value) {
    return "keine Daten";
  }

  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    return "keine Daten";
  }

  return new Date(ts).toLocaleString("de-DE");
}

function inferStatus(raw) {
  const normalized = String(raw || "").toLowerCase();
  if (["ok", "success", "successful", "completed", "true"].includes(normalized)) return "ok";
  if (normalized.includes("warn")) return "warn";
  if (
    ["error", "failed", "fail", "fatal", "false"].includes(normalized) ||
    normalized.includes("error") ||
    normalized.includes("fail")
  ) {
    return "error";
  }
  return null;
}

function normalizeBackupStatus(payload, source) {
  const data = Array.isArray(payload?.backups) ? payload.backups[0] || {} : payload || {};
  const details = data?.details && typeof data.details === "object" ? data.details : {};

  const direct =
    data?.status ||
    data?.public?.status ||
    data?.rawResult ||
    data?.result ||
    data?.outcome ||
    null;

  const byLabel = inferStatus(data?.label);
  const byDirect = inferStatus(direct);

  let status = byDirect || byLabel || "unknown";

  const warnings = Number(data?.warnings ?? data?.warning_count ?? data?.warningCount ?? 0);
  const errors = Number(data?.errors ?? data?.error_count ?? data?.errorCount ?? 0);
  const exitCode = Number(data?.exitCode ?? data?.exit_code ?? NaN);

  if (status === "unknown") {
    if (errors > 0 || Number.isFinite(exitCode) && exitCode > 0) status = "error";
    else if (warnings > 0) status = "warn";
  }

  return {
    source,
    status,
    label: mapStatusLabel(status),
    rawLabel: data?.label || null,
    checkedAt:
      data?.checkedAt ||
      data?.checked_at ||
      data?.lastRunAt ||
      data?.last_run_at ||
      data?.lastCheckedAt ||
      data?.last_checked_at ||
      data?.public?.checkedAt ||
      data?.public?.checked_at ||
      details?.checked_at ||
      data?.timestamp ||
      null,
    backupName: data?.backupName || data?.backup_name || details?.backup_name || source,
    lastSuccess:
      data?.lastSuccess ||
      data?.last_success ||
      details?.last_success ||
      null,
    message: data?.message || details?.message || data?.error || null,
  };
}

async function fetchBackupStatus(source) {
  const variants = [
    `/backup/status?source=${encodeURIComponent(source)}`,
    `/backup/status?backup_name=${encodeURIComponent(source)}`,
  ];

  let lastError = null;

  for (const url of variants) {
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Unerwartete Antwort (${contentType || "kein Content-Type"}). ` +
          `Haeufige Ursache: Landing/Proxy liefert HTML statt /backup/status-JSON. ` +
          `Vorschau: ${text.slice(0, 80)}`
        );
      }

      const payload = await response.json();
      const normalized = normalizeBackupStatus(payload, source);

      // Accept first non-unknown result; otherwise try legacy variant next.
      if (normalized.status !== "unknown" || url.includes("backup_name=")) {
        return normalized;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return normalizeBackupStatus({}, source);
}

function renderBackupCard(result) {
  const card = document.getElementById(`backup-card-${result.source}`);
  if (!card) return;

  const statusNode = card.querySelector("[data-backup-status]");
  const detailNode = card.querySelector("[data-backup-detail]");

  card.classList.remove("backup-state-ok", "backup-state-warn", "backup-state-error", "backup-state-unknown");
  card.classList.add(`backup-state-${result.status}`);

  if (statusNode) {
    statusNode.textContent = result.rawLabel || result.label;
  }

  if (detailNode) {
    const backupName = result.backupName || result.source || "-";
    const lastRun = formatTimestamp(result.checkedAt || result.lastSuccess || null);
    const message = result.message ? String(result.message) : null;
    detailNode.textContent = `Backup: ${backupName} | Letzter Lauf: ${lastRun}${message ? ` | ${message}` : ""}`;
  }
}

function renderBackupFailure(source, error) {
  renderBackupCard({
    source,
    status: "unknown",
    label: "Backupstatus unbekannt",
    checkedAt: null,
  });

  const card = document.getElementById(`backup-card-${source}`);
  const detailNode = card ? card.querySelector("[data-backup-detail]") : null;
  if (detailNode) {
    detailNode.textContent = `Fehler: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function loadBackupStatus() {
  const sources = ["duplicati", "restic"];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await fetchBackupStatus(source);
        renderBackupCard(result);
      } catch (error) {
        renderBackupFailure(source, error);
      }
    })
  );
}

async function loadProfile() {
  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const profile = await response.json();
    renderIdentity(profile);
  } catch (error) {
    renderFallback(error instanceof Error ? error.message : String(error));
  }
}

initializeThemeToggle();
hydrateLinks();
loadProfile();
loadBackupStatus();
