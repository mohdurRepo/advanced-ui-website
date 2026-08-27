/* ==========================================================================
   Standard Company Identity
   ========================================================================== */

/*
 * Shared company identity renderer for business data views.
 *
 * Responsibilities:
 *
 * - resolve company name, code, link, and logo
 * - render the standard desktop table identity
 * - render the standard mobile-card identity
 * - handle image and fallback-image failures
 * - escape rendered business data
 *
 * The rendered visual structure follows Market Watch:
 *
 * - company logo
 * - company name
 * - company code below the name
 *
 * Watchlist controls and page-specific status indicators remain owned by
 * their respective page modules.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const LOGO_SELECTOR = "[data-standard-company-logo]";

const UNSAFE_URL_PATTERN = /^(?:javascript|data|vbscript):/i;

/* ==========================================================================
   Value Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function normalizeSize(value, fallback) {
  const size = Number(value);

  return Number.isFinite(size) && size > 0 ? size : fallback;
}

/* ==========================================================================
   HTML
   ========================================================================== */

function escapeHtml(value) {
  if (value == null) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ==========================================================================
   URL Safety
   ========================================================================== */

function getSafeUrl(value) {
  const url = normalizeString(value);

  if (!url || UNSAFE_URL_PATTERN.test(url)) {
    return "";
  }

  return url;
}

/* ==========================================================================
   Company Values
   ========================================================================== */

export function getStandardCompanyName(row = {}) {
  return normalizeString(
    firstDefined(row.acrynomName, row.companyName, row.company, row.name),
    "-",
  );
}

export function getStandardCompanyCode(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
    ),
  );
}

export function getStandardCompanyUrl(row = {}) {
  return getSafeUrl(firstDefined(row.companyUrl, row.companyURL, row.pageUrl));
}

/* ==========================================================================
   Initials
   ========================================================================== */

function getCompanyInitials(row = {}) {
  return getStandardCompanyName(row)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/* ==========================================================================
   Logo Configuration
   ========================================================================== */

function getAssets(config = {}) {
  return config?.assets && typeof config.assets === "object"
    ? config.assets
    : {};
}

export function getStandardCompanyLogoFallbackUrl(config = {}) {
  return getSafeUrl(getAssets(config).companyLogoFallbackUrl);
}

export function getStandardCompanyLogoUrl(row = {}, config = {}) {
  const directUrl = getSafeUrl(
    firstDefined(
      row.companyLogoUrl,
      row.logoUrl,
      row.imageUrl,
      row.companyImageUrl,
    ),
  );

  if (directUrl) {
    return directUrl;
  }

  const template = getSafeUrl(getAssets(config).companyLogoUrlTemplate);

  const companyCode = getStandardCompanyCode(row);

  if (!template || !companyCode) {
    return getStandardCompanyLogoFallbackUrl(config);
  }

  return template.replaceAll("{companyCode}", encodeURIComponent(companyCode));
}

/* ==========================================================================
   Logo Fallback Markup
   ========================================================================== */

function renderLogoFallback(initials, fallbackClassName) {
  return `
    <span
      class="${escapeHtml(fallbackClassName)}"
      aria-hidden="true"
    >
      ${escapeHtml(initials || "—")}
    </span>
  `.trim();
}

/* ==========================================================================
   Logo Rendering
   ========================================================================== */

export function renderStandardCompanyLogo(row = {}, config = {}, options = {}) {
  const className = options.className || "table-market__logo";

  const fallbackClassName =
    options.fallbackClassName || `${className}-fallback`;

  const size = normalizeSize(options.size, 40);

  const logoUrl = getStandardCompanyLogoUrl(row, config);

  const fallbackUrl = getStandardCompanyLogoFallbackUrl(config);

  const initials = getCompanyInitials(row);

  if (!logoUrl) {
    return `
      <span
        class="${escapeHtml(className)} is-image-missing"
        data-standard-company-logo-container
        data-standard-company-logo-fallback-class="${escapeHtml(
          fallbackClassName,
        )}"
        aria-hidden="true"
      >
        ${renderLogoFallback(initials, fallbackClassName)}
      </span>
    `.trim();
  }

  const fallbackAttribute =
    fallbackUrl && fallbackUrl !== logoUrl
      ? `
        data-standard-company-logo-fallback="${escapeHtml(fallbackUrl)}"
      `.trim()
      : "";

  return `
    <span
      class="${escapeHtml(className)}"
      data-standard-company-logo-container
      data-standard-company-logo-fallback-class="${escapeHtml(
        fallbackClassName,
      )}"
      aria-hidden="true"
    >
      <img
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="${size}"
        height="${size}"
        loading="lazy"
        decoding="async"
        data-standard-company-logo
        data-standard-company-logo-initials="${escapeHtml(initials)}"
        ${fallbackAttribute}
      />
    </span>
  `.trim();
}

/* ==========================================================================
   Desktop Identity Text
   ========================================================================== */

function renderDesktopIdentityText(row = {}) {
  const companyName = getStandardCompanyName(row);

  const companyCode = getStandardCompanyCode(row);

  const companyUrl = getStandardCompanyUrl(row);

  const codeMarkup = companyCode
    ? `
        <span class="table-market__symbol">
          ${escapeHtml(companyCode)}
        </span>
      `.trim()
    : "";

  const content = `
    <span class="table-market__name">
      ${escapeHtml(companyName)}
    </span>

    ${codeMarkup}
  `.trim();

  if (!companyUrl) {
    return `
      <span class="table-market__security-link">
        ${content}
      </span>
    `.trim();
  }

  return `
    <a
      class="table-market__security-link"
      href="${escapeHtml(companyUrl)}"
    >
      ${content}
    </a>
  `.trim();
}

/* ==========================================================================
   Desktop Table Identity
   ========================================================================== */

export function renderStandardCompanyCell(row = {}, config = {}) {
  return `
    <div class="table-market__security-cell">
      ${renderStandardCompanyLogo(row, config, {
        className: "table-market__logo",
        fallbackClassName: "table-market__logo-fallback",
        size: 40,
      })}

      ${renderDesktopIdentityText(row)}
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Identity Text
   ========================================================================== */

function renderMobileIdentityText(row = {}) {
  const companyName = getStandardCompanyName(row);

  const companyCode = getStandardCompanyCode(row);

  const companyUrl = getStandardCompanyUrl(row);

  const codeMarkup = companyCode
    ? `
        <span class="data-card__symbol">
          ${escapeHtml(companyCode)}
        </span>
      `.trim()
    : "";

  const content = `
    <div class="data-card__identity-content">
      <h3 class="data-card__title">
        ${escapeHtml(companyName)}
      </h3>

      ${codeMarkup}
    </div>
  `.trim();

  if (!companyUrl) {
    return content;
  }

  return `
    <a
      class="data-card__security-link"
      href="${escapeHtml(companyUrl)}"
    >
      ${content}
    </a>
  `.trim();
}

/* ==========================================================================
   Mobile Card Identity
   ========================================================================== */

export function renderStandardCompanyCardIdentity(row = {}, config = {}) {
  return `
    <div class="data-card__identity">
      ${renderStandardCompanyLogo(row, config, {
        className: "data-card__logo",
        fallbackClassName: "data-card__logo-fallback",
        size: 44,
      })}

      ${renderMobileIdentityText(row)}
    </div>
  `.trim();
}

/* ==========================================================================
   Logo Error Handling
   ========================================================================== */

export function handleStandardCompanyLogoError(event, root = document) {
  const image = event?.target;

  if (!(image instanceof HTMLImageElement) || !image.matches(LOGO_SELECTOR)) {
    return false;
  }

  if (root && typeof root.contains === "function" && !root.contains(image)) {
    return false;
  }

  const fallbackUrl = image.dataset.standardCompanyLogoFallback;

  const fallbackApplied =
    image.dataset.standardCompanyLogoFallbackApplied === "true";

  /*
   * Attempt the configured fallback image once.
   */

  if (fallbackUrl && !fallbackApplied) {
    image.dataset.standardCompanyLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return true;
  }

  /*
   * The original and fallback images both failed.
   */

  const container = image.closest("[data-standard-company-logo-container]");

  if (!container) {
    image.remove();

    return true;
  }

  const fallbackClassName =
    container.dataset.standardCompanyLogoFallbackClass ||
    "table-market__logo-fallback";

  const fallback = document.createElement("span");

  fallback.className = fallbackClassName;

  fallback.setAttribute("aria-hidden", "true");

  fallback.textContent = image.dataset.standardCompanyLogoInitials || "—";

  container.classList.add("is-image-missing");

  image.replaceWith(fallback);

  return true;
}

/* ==========================================================================
   Logo Error Binding
   ========================================================================== */

export function bindStandardCompanyLogoFallback(root = document) {
  if (!root || typeof root.addEventListener !== "function") {
    throw new TypeError("Company logo fallback requires an event target.");
  }

  const handleError = (event) => {
    handleStandardCompanyLogoError(event, root);
  };

  /*
   * Image error events do not bubble, so capture is required.
   */

  root.addEventListener("error", handleError, true);

  return function unbindCompanyLogoFallback() {
    root.removeEventListener("error", handleError, true);
  };
}
