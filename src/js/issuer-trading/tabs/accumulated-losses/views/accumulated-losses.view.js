/* ==========================================================================
   Accumulated Losses View
   ========================================================================== */

/*
 * Responsive content-feed presentation for Accumulated Losses.
 *
 * Responsibilities:
 *
 * - render all returned companies
 * - render company image, name, and code
 * - render loading, empty, and error states
 * - preserve accessibility across state changes
 *
 * This view is responsive by itself. It does not maintain separate desktop
 * and mobile presentations.
 *
 * This module intentionally has no:
 *
 * - endpoint configuration
 * - request transport
 * - filter behavior
 * - response normalization
 * - pagination
 * - tab lifecycle coordination
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  getStandardCompanyCode,
  getStandardCompanyLogoFallbackUrl,
  getStandardCompanyLogoUrl,
  getStandardCompanyName,
  getStandardCompanyUrl,
} from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOADING_COUNT = 5;

const DEFAULT_LABELS = Object.freeze({
  loading: "Loading results\u2026",

  noData: "No data available.",

  error: "Unable to load data.",
});

const SELECTORS = Object.freeze({
  view: "[data-accumulated-losses-view]",

  list: "[data-accumulated-losses-list]",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function getRootElement(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError("Accumulated Losses view requires a valid root element.");
}

function resolveRequiredElement(root, selector, name) {
  const element = root.querySelector(selector);

  if (!isElement(element)) {
    throw new Error(`Accumulated Losses ${name} was not found.`);
  }

  return element;
}

function getLabels(config = {}) {
  return Object.freeze({
    loading: normalizeString(config.labels?.loading) || DEFAULT_LABELS.loading,

    noData: normalizeString(config.labels?.noData) || DEFAULT_LABELS.noData,

    error: normalizeString(config.labels?.error) || DEFAULT_LABELS.error,
  });
}

/* ==========================================================================
   Company Logo
   ========================================================================== */

function getCompanyInitials(row = {}) {
  const companyName = getStandardCompanyName(row);

  if (!companyName || companyName === "-") {
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

function renderCompanyLogo(row, config) {
  const logoUrl = getStandardCompanyLogoUrl(row, config);

  const fallbackUrl = getStandardCompanyLogoFallbackUrl(config);

  const initials = getCompanyInitials(row) || "—";

  if (!logoUrl) {
    return `
      <figure
        class="content-item__media is-image-missing"
        data-standard-company-logo-container
        data-standard-company-logo-fallback-class="content-item__image-fallback"
        aria-hidden="true"
      >
        <span class="content-item__image-fallback">
          ${escapeHtml(initials)}
        </span>
      </figure>
    `.trim();
  }

  const fallbackAttribute =
    fallbackUrl && fallbackUrl !== logoUrl
      ? `data-standard-company-logo-fallback="${escapeHtml(fallbackUrl)}"`
      : "";

  return `
    <figure
      class="content-item__media"
      data-standard-company-logo-container
      data-standard-company-logo-fallback-class="content-item__image-fallback"
      aria-hidden="true"
    >
      <img
        class="content-item__image"
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="64"
        height="64"
        loading="lazy"
        decoding="async"
        data-standard-company-logo
        data-standard-company-logo-initials="${escapeHtml(initials)}"
        ${fallbackAttribute}
      />
    </figure>
  `.trim();
}

/* ==========================================================================
   Company Name
   ========================================================================== */

function renderCompanyName(row) {
  const companyName = getStandardCompanyName(row);

  const companyUrl = getStandardCompanyUrl(row);

  if (!companyUrl) {
    return `
      <span class="content-item__link">
        ${escapeHtml(companyName)}
      </span>
    `.trim();
  }

  return `
    <a
      class="content-item__link"
      href="${escapeHtml(companyUrl)}"
    >
      ${escapeHtml(companyName)}
    </a>
  `.trim();
}

/* ==========================================================================
   Company Result
   ========================================================================== */

function renderCompanyItem(row, config) {
  const rowId = normalizeString(row?.id);

  const companyCode = getStandardCompanyCode(row) || "—";

  const rowAttribute = rowId
    ? `data-accumulated-losses-row="${escapeHtml(rowId)}"`
    : "";

  return `
    <li
      class="content-feed__list-item"
      ${rowAttribute}
    >
      <article class="content-item content-item--company">
        ${renderCompanyLogo(row, config)}

        <div class="content-item__content">
          <div class="content-item__summary">
            <span class="content-item__symbol">
              ${escapeHtml(companyCode)}
            </span>
          </div>

          <h3 class="content-item__title">
            ${renderCompanyName(row)}
          </h3>
        </div>
      </article>
    </li>
  `.trim();
}

/* ==========================================================================
   Loading
   ========================================================================== */

function renderLoadingItem() {
  return `
    <li
      class="content-feed__list-item"
      aria-hidden="true"
    >
      <article class="content-item content-item--company is-loading">
        <span class="content-item__media">
          <span
            class="table-skeleton table-skeleton-md"
          ></span>
        </span>

        <div class="content-item__content">
          <div class="content-item__summary">
            <span
              class="table-skeleton table-skeleton-sm"
            ></span>
          </div>

          <div class="content-item__title">
            <span
              class="table-skeleton table-skeleton-lg"
            ></span>
          </div>
        </div>
      </article>
    </li>
  `.trim();
}

/* ==========================================================================
   Empty and Error States
   ========================================================================== */

function renderMessage({ message, imageUrl = "", isError = false }) {
  const imageMarkup = imageUrl
    ? `
        <img
          class="content-feed__empty-image"
          src="${escapeHtml(imageUrl)}"
          alt=""
          loading="lazy"
          aria-hidden="true"
        />
      `.trim()
    : "";

  return `
    <li class="content-feed__list-item">
      <div
        class="data-view__empty content-feed__message${
          isError ? " is-error" : ""
        }"
        ${isError ? 'role="alert"' : ""}
      >
        ${imageMarkup}

        <p class="content-feed__message-text">
          ${escapeHtml(message)}
        </p>
      </div>
    </li>
  `.trim();
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createAccumulatedLossesView(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createAccumulatedLossesView requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const config = isObject(options.config) ? options.config : {};

  const labels = getLabels(config);

  const viewElement = resolveRequiredElement(
    root,
    SELECTORS.view,
    "content feed",
  );

  const listElement = resolveRequiredElement(
    root,
    SELECTORS.list,
    "result list",
  );

  const noDataImageUrl = normalizeString(config.assets?.noDataImageUrl);

  let rows = [];

  let destroyed = false;

  /* ========================================================================
     Busy State
     ======================================================================== */

  function setBusy(busy) {
    const value = String(Boolean(busy));

    viewElement.setAttribute("aria-busy", value);

    listElement.setAttribute("aria-busy", value);
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function renderLoading(count = DEFAULT_LOADING_COUNT) {
    if (destroyed) {
      return;
    }

    rows = [];

    setBusy(true);

    const loadingCount = Math.max(1, Number(count) || DEFAULT_LOADING_COUNT);

    listElement.innerHTML = Array.from(
      {
        length: loadingCount,
      },
      renderLoadingItem,
    ).join("");
  }

  /* ========================================================================
     Results
     ======================================================================== */

  function renderRows(nextRows = []) {
    if (destroyed) {
      return;
    }

    rows = Array.isArray(nextRows) ? [...nextRows] : [];

    setBusy(false);

    if (!rows.length) {
      renderEmpty();

      return;
    }

    /*
     * Accumulated Losses intentionally has no pagination.
     *
     * Every company returned by the service is rendered in the same
     * responsive content-feed list.
     */

    listElement.innerHTML = rows
      .map((row) => renderCompanyItem(row, config))
      .join("");
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function renderEmpty(message = labels.noData) {
    if (destroyed) {
      return;
    }

    rows = [];

    setBusy(false);

    listElement.innerHTML = renderMessage({
      message: normalizeString(message) || labels.noData,

      imageUrl: noDataImageUrl,
    });
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function renderError(message = labels.error) {
    if (destroyed) {
      return;
    }

    rows = [];

    setBusy(false);

    listElement.innerHTML = renderMessage({
      message: normalizeString(message) || labels.error,

      isError: true,
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    rows = [];

    setBusy(false);
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    renderEmpty,
    renderError,
    renderLoading,
    renderRows,

    getRows() {
      return [...rows];
    },
  });
}
