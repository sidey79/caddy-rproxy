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

function renderBackupStatus(data) {
  const target = document.getElementById("backup-status");
  if (!target) return;

  const map = {
    ok: "Backup OK",
    warn: "Backup mit Warnungen",
    error: "Backup fehlgeschlagen",
    unknown: "Backupstatus unbekannt",
  };

  const status = data?.status || "unknown";
  const label = map[status] || map.unknown;
  const checkedAt = data?.checkedAt ? new Date(data.checkedAt).toLocaleString("de-DE") : "keine Daten";
  const backupName = data?.backupName ? ` (${data.backupName})` : "";

  target.textContent = `${label}${backupName} • Stand: ${checkedAt}`;
}

async function loadBackupStatus() {
  try {
    const response = await fetch("/duplicati/webhook/duplicati/duplicati-status-public", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    renderBackupStatus(payload);
  } catch (error) {
    const target = document.getElementById("backup-status");
    if (target) {
      target.textContent = `Backupstatus konnte nicht geladen werden (${error instanceof Error ? error.message : String(error)})`;
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
