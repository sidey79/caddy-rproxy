function buildServiceUrl(subdomain, path = "") {
  const host = window.location.hostname;
  const baseHost = host.replace(/^landing\./, "");
  const normalizedPath = path || "";

  if (!subdomain || !baseHost || baseHost === host) {
    return normalizedPath || "/";
  }

  return `https://${subdomain}.${baseHost}${normalizedPath}`;
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

hydrateLinks();
loadProfile();
