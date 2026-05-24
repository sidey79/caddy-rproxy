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

function normalizeBackupStatus(payload, source) {
  return {
    source,
    status: payload?.status || "unknown",
    label: mapStatusLabel(payload?.status),
    checkedAt: payload?.checkedAt || null,
    backupName: payload?.backupName || source,
    message: payload?.message || null,
  };
}

async function fetchBackupStatus(source) {
  const response = await fetch(`/backup/status?source=${encodeURIComponent(source)}`, {
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
  return normalizeBackupStatus(payload, source);
}

function renderBackupCard(result) {
  const card = document.getElementById(`backup-card-${result.source}`);
  if (!card) return;

  const statusNode = card.querySelector("[data-backup-status]");
  const detailNode = card.querySelector("[data-backup-detail]");

  card.classList.remove("backup-state-ok", "backup-state-warn", "backup-state-error", "backup-state-unknown");
  card.classList.add(`backup-state-${result.status}`);

  if (statusNode) {
    statusNode.textContent = result.label;
  }

  if (detailNode) {
    detailNode.textContent = `Stand: ${formatTimestamp(result.checkedAt)}`;
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
