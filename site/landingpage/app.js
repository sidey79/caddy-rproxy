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

function renderBackupStatusList(payload) {
  const statusTarget = document.getElementById("backup-status");
  const listTarget = document.getElementById("backup-list");
  if (!statusTarget || !listTarget) return;

  const backups = Array.isArray(payload?.backups) ? payload.backups : [];

  if (!backups.length) {
    statusTarget.textContent = "Keine Backupdaten vorhanden.";
    listTarget.replaceChildren();
    return;
  }

  const latestTs = backups
    .map((b) => (b.lastCheckedAt ? Date.parse(b.lastCheckedAt) : 0))
    .reduce((max, ts) => (ts > max ? ts : max), 0);
  const latestText = latestTs ? new Date(latestTs).toLocaleString("de-DE") : "keine Daten";

  statusTarget.textContent = `Backups: ${backups.length} • Letztes Update: ${latestText}`;

  listTarget.replaceChildren();
  backups.forEach((backup) => {
    const name = backup.backupName || "unbekannt";
    const label = mapStatusLabel(backup.status);
    const checkedAt = backup.lastCheckedAt ? new Date(backup.lastCheckedAt).toLocaleString("de-DE") : "keine Daten";

    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = name;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(`: ${label} • Stand: ${checkedAt}`));
    listTarget.appendChild(li);
  });
}

async function loadBackupStatus() {
  const target = document.getElementById("backup-status");
  const listTarget = document.getElementById("backup-list");

  try {
    const response = await fetch("/backup/names", {
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
        `Haeufige Ursache: Landing/Proxy liefert HTML statt /backup/names-JSON. ` +
        `Vorschau: ${text.slice(0, 80)}`
      );
    }

    const payload = await response.json();
    renderBackupStatusList(payload);
  } catch (error) {
    if (target) {
      target.textContent = `Backupstatus konnte nicht geladen werden (${error instanceof Error ? error.message : String(error)})`;
    }
    if (listTarget) {
      listTarget.replaceChildren();
    }
  }
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
