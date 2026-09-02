/* ==========================================================================
   Standard Company Identity
   ========================================================================== */

/*
 * Shared company identity renderer for business data views.
 *
 * Responsibilities:
 *
 * - resolve company name, code, link, and logo
 * - replace the logo template token for each data row
 * - render the standard desktop table identity
 * - render the standard mobile-card identity
 * - support optional page-owned leading content
 * - support optional metadata beside the company code
 * - support optional metadata beside the company name
 * - apply the configured fallback logo once
 * - fall back to company initials if both images fail
 * - escape rendered business data
 *
 * The rendered visual structure follows Market Watch:
 *
 * - optional page-owned leading content
 * - company logo
 * - company name
 * - optional name metadata
 * - company code below the name
 * - optional code metadata
 *
 * Watchlist controls and page-specific status indicators remain owned by
 * their respective page modules.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const LOGO_SELECTOR = "[data-standard-company-logo]";

const LOGO_CONTAINER_SELECTOR = "[data-standard-company-logo-container]";

const COMPANY_CODE_TOKEN = "{companyCode}";

const DEFAULT_COMPANY_NAME = "-";

const DEFAULT_LOGO_INITIALS = "—";

const UNSAFE_URL_PATTERN = /^(?:javascript|data|vbscript):/i;

/* ==========================================================================
   Value Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeSize(value, fallback) {
  const size = Number(value);

  return Number.isFinite(size) && size > 0 ? size : fallback;
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function isImageElement(value) {
  return (
    isElement(value) &&
    value.tagName === "IMG" &&
    typeof value.matches === "function"
  );
}

/* ==========================================================================
   HTML Escaping
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

function firstSafeUrl(...values) {
  for (const value of values) {
    const safeUrl = getSafeUrl(value);

    if (safeUrl) {
      return safeUrl;
    }
  }

  return "";
}

/* ==========================================================================
   Company Values
   ========================================================================== */

export function getStandardCompanyName(row = {}) {
  return (
    firstNonEmptyString(
      row.acrynomName,
      row.acronymName,
      row.companyName,
      row.longName,
      row.shortName,
      row.company,
      row.name,
    ) || DEFAULT_COMPANY_NAME
  );
}

export function getStandardCompanyCode(row = {}) {
  return firstNonEmptyString(
    row.companyCode,
    row.companyRef,
    row.companySymbol,
    row.securityCode,
    row.symbol,
    row.code,
  );
}

export function getStandardCompanyUrl(row = {}) {
  return firstSafeUrl(row.companyUrl, row.companyURL, row.pageUrl, row.url);
}

/* ==========================================================================
   Company Initials
   ========================================================================== */

function getCompanyInitials(row = {}) {
  const companyName = getStandardCompanyName(row);

  if (!companyName || companyName === DEFAULT_COMPANY_NAME) {
    return "";
  }

  return companyName
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

/*
 * Supported configuration shapes:
 *
 * Full page configuration:
 *
 * {
 *   assets: {
 *     companyLogoUrlTemplate: ".../{companyCode}.png",
 *     companyLogoFallbackUrl: ".../default.png"
 *   }
 * }
 *
 * Explicit identity configuration:
 *
 * {
 *   logoUrlTemplate: ".../{companyCode}.png",
 *   logoFallbackUrl: ".../default.png"
 * }
 */

function getLogoConfiguration(config = {}) {
  const normalizedConfig = isObject(config) ? config : {};

  const assets = isObject(normalizedConfig.assets)
    ? normalizedConfig.assets
    : {};

  return {
    logoUrlTemplate: firstSafeUrl(
      normalizedConfig.logoUrlTemplate,

      normalizedConfig.companyLogoUrlTemplate,

      assets.companyLogoUrlTemplate,
    ),

    logoFallbackUrl: firstSafeUrl(
      normalizedConfig.logoFallbackUrl,

      normalizedConfig.companyLogoFallbackUrl,

      assets.companyLogoFallbackUrl,
    ),
  };
}

export function getStandardCompanyLogoFallbackUrl(config = {}) {
  return getLogoConfiguration(config).logoFallbackUrl;
}

/* ==========================================================================
   Logo URL Resolution
   ========================================================================== */

function applyCompanyCodeToTemplate(template, companyCode) {
  if (!template || !companyCode) {
    return "";
  }

  const encodedCompanyCode = encodeURIComponent(companyCode);

  return template.replaceAll(COMPANY_CODE_TOKEN, encodedCompanyCode);
}

export function getStandardCompanyLogoUrl(row = {}, config = {}) {
  /*
   * A row-provided logo URL takes precedence over the configured template.
   */

  const directUrl = firstSafeUrl(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
    row.logo,
  );

  if (directUrl) {
    return directUrl;
  }

  const { logoUrlTemplate, logoFallbackUrl } = getLogoConfiguration(config);

  const companyCode = getStandardCompanyCode(row);

  if (!logoUrlTemplate || !companyCode) {
    return logoFallbackUrl;
  }

  /*
   * The replacement happens here for every rendered row:
   *
   * .../{companyCode}.png
   *
   * becomes:
   *
   * .../1010.png
   */

  const companyLogoUrl = applyCompanyCodeToTemplate(
    logoUrlTemplate,
    companyCode,
  );

  return getSafeUrl(companyLogoUrl) || logoFallbackUrl;
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
      ${escapeHtml(initials || DEFAULT_LOGO_INITIALS)}
    </span>
  `.trim();
}

/* ==========================================================================
   Logo Rendering
   ========================================================================== */

export function renderStandardCompanyLogo(row = {}, config = {}, options = {}) {
  const className = normalizeString(options.className) || "table-market__logo";

  const fallbackClassName =
    normalizeString(options.fallbackClassName) || `${className}-fallback`;

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
      ? `data-standard-company-logo-fallback="${escapeHtml(fallbackUrl)}"`
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

function renderDesktopIdentityText(row = {}, options = {}) {
  const companyName = getStandardCompanyName(row);

  const companyCode = getStandardCompanyCode(row);

  const companyUrl = getStandardCompanyUrl(row);

  /*
   * nameMetadata:
   *
   * Appears beside the company name.
   *
   * Example:
   *
   * Company Name [metadata]
   */

  const nameMetadata = String(options.nameMetadata || "").trim();

  /*
   * metadata:
   *
   * Appears beside the company code.
   *
   * Example:
   *
   * 2222 [accumulated-loss indicator]
   *
   * Market Watch uses this location for companyStatus.
   */

  const metadata = String(options.metadata || "").trim();

  const codeMarkup =
    companyCode || metadata
      ? `
          <span class="table-market__identity-code">
            ${
              companyCode
                ? `
                    <span class="table-market__symbol">
                      ${escapeHtml(companyCode)}
                    </span>
                  `.trim()
                : ""
            }

            ${metadata}
          </span>
        `.trim()
      : "";

  const content = `
    <span class="table-market__name">
      ${escapeHtml(companyName)}

      ${nameMetadata}
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

export function renderStandardCompanyCell(row = {}, config = {}, options = {}) {
  const leading = String(options.leading || "").trim();

  return `
    <div class="table-market__security-cell">
      ${leading}

      ${renderStandardCompanyLogo(row, config, {
        className: "table-market__logo",

        fallbackClassName: "table-market__logo-fallback",

        size: 40,
      })}

      ${renderDesktopIdentityText(row, options)}
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Identity Text
   ========================================================================== */

function renderMobileIdentityText(row = {}, options = {}) {
  const companyName = getStandardCompanyName(row);

  const companyCode = getStandardCompanyCode(row);

  const companyUrl = getStandardCompanyUrl(row);

  const nameMetadata = String(options.nameMetadata || "").trim();

  const metadata = String(options.metadata || "").trim();

  const codeMarkup =
    companyCode || metadata
      ? `
          <span class="data-card__identity-code">
            ${
              companyCode
                ? `
                    <span class="data-card__symbol">
                      ${escapeHtml(companyCode)}
                    </span>
                  `.trim()
                : ""
            }

            ${metadata}
          </span>
        `.trim()
      : "";

  const content = `
    <div class="data-card__identity-content">
      <h3 class="data-card__title">
        ${escapeHtml(companyName)}

        ${nameMetadata}
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

export function renderStandardCompanyCardIdentity(
  row = {},
  config = {},
  options = {},
) {
  const leading = String(options.leading || "").trim();

  return `
    <div class="data-card__identity">
      ${leading}

      ${renderStandardCompanyLogo(row, config, {
        className: "data-card__logo",

        fallbackClassName: "data-card__logo-fallback",

        size: 44,
      })}

      ${renderMobileIdentityText(row, options)}
    </div>
  `.trim();
}

/* ==========================================================================
   Logo Error Handling
   ========================================================================== */

export function handleStandardCompanyLogoError(event, root = document) {
  const image = event?.target;

  if (!isImageElement(image) || !image.matches(LOGO_SELECTOR)) {
    return false;
  }

  if (root && typeof root.contains === "function" && !root.contains(image)) {
    return false;
  }

  const fallbackUrl = getSafeUrl(image.dataset.standardCompanyLogoFallback);

  const fallbackApplied =
    image.dataset.standardCompanyLogoFallbackApplied === "true";

  /*
   * Attempt the configured fallback image only once.
   */

  if (fallbackUrl && !fallbackApplied) {
    image.dataset.standardCompanyLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return true;
  }

  /*
   * The company-specific image and fallback image both failed.
   */

  const container = image.closest(LOGO_CONTAINER_SELECTOR);

  if (!container) {
    image.remove();

    return true;
  }

  const fallbackClassName =
    normalizeString(container.dataset.standardCompanyLogoFallbackClass) ||
    "table-market__logo-fallback";

  const fallback = image.ownerDocument.createElement("span");

  fallback.className = fallbackClassName;

  fallback.setAttribute("aria-hidden", "true");

  fallback.textContent =
    normalizeString(image.dataset.standardCompanyLogoInitials) ||
    DEFAULT_LOGO_INITIALS;

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

  function handleError(event) {
    handleStandardCompanyLogoError(event, root);
  }

  /*
   * Image error events do not bubble, so capture mode is required.
   */

  root.addEventListener("error", handleError, true);

  return function unbindStandardCompanyLogoFallback() {
    root.removeEventListener("error", handleError, true);
  };
}
