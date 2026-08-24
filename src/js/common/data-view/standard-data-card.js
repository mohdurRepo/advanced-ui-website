/* ==========================================================================
   Standard Data Card
   ========================================================================== */

/*
 * Reusable renderer for the standard design-system Data Card pattern.
 *
 * Responsibilities:
 *
 * - render standard card structure
 * - render summary / identity content
 * - render expandable details
 * - render standard field layout
 * - create safe unique details IDs
 * - provide DataViewCard accessibility hooks
 *
 * This module intentionally has no:
 *
 * - event listeners
 * - expand / collapse behavior
 * - breakpoint logic
 * - AJAX code
 * - page-specific business formatting
 *
 * Expand / collapse behavior remains owned by the existing
 * design-system DataViewCard component.
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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

function createSafeId(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$|/g, "");

  return normalized || "item";
}

function normalizeFields(fields = []) {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.filter((field) => field && typeof field === "object");
}

/* ==========================================================================
   Field Rendering
   ========================================================================== */

export function renderStandardDataCardField(field = {}) {
  const {
    label = "",
    value = "",
    className = "",
    labelClassName = "",
    valueClassName = "",
    fullWidth = false,
    numeric = false,
  } = field;

  const fieldClasses = [
    "data-card__field",

    fullWidth ? "data-card__field--full" : "",

    className,
  ]
    .filter(Boolean)
    .join(" ");

  const labelClasses = ["data-card__label", labelClassName]
    .filter(Boolean)
    .join(" ");

  const valueClasses = [
    "data-card__value",

    numeric ? "data-card__value--numeric" : "",

    valueClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${escapeHtml(fieldClasses)}">
      <dt class="${escapeHtml(labelClasses)}">
        ${escapeHtml(label)}
      </dt>

      <dd class="${escapeHtml(valueClasses)}">
        ${value}
      </dd>
    </div>
  `.trim();
}

/* ==========================================================================
   Field Collection
   ========================================================================== */

export function renderStandardDataCardFields(fields = []) {
  return normalizeFields(fields).map(renderStandardDataCardField).join("");
}

/* ==========================================================================
   Default Toggle Labels
   ========================================================================== */

function getToggleLabels(options) {
  const moreLabel = String(options.moreLabel || "More details").trim();

  const lessLabel = String(options.lessLabel || "Less details").trim();

  return {
    moreLabel,
    lessLabel,
  };
}

/* ==========================================================================
   Details ID
   ========================================================================== */

function getDetailsId(options) {
  if (options.detailsId) {
    return createSafeId(options.detailsId);
  }

  const prefix = createSafeId(options.idPrefix || "data-card-details");

  const rowId = createSafeId(options.rowId || options.index || "item");

  return `${prefix}-${rowId}`;
}

/* ==========================================================================
   Public Renderer
   ========================================================================== */

export function renderStandardDataCard(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("renderStandardDataCard requires an options object.");
  }

  const detailsId = getDetailsId(options);

  const { moreLabel, lessLabel } = getToggleLabels(options);

  const cardClassName = ["data-card", options.className || ""]
    .filter(Boolean)
    .join(" ");

  const mainClassName = ["data-card__main", options.mainClassName || ""]
    .filter(Boolean)
    .join(" ");

  const detailsClassName = [
    "data-card__details",
    options.detailsClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  const fieldsClassName = ["data-card__fields", options.fieldsClassName || ""]
    .filter(Boolean)
    .join(" ");

  const toggleClassName = ["data-card__toggle", options.toggleClassName || ""]
    .filter(Boolean)
    .join(" ");

  const fields = renderStandardDataCardFields(options.fields);

  /*
   * `summary` is raw rendered markup supplied by the page/module.
   *
   * Examples:
   *
   * Market Watch:
   *   identity + quote
   *
   * Sukuk:
   *   security identity + yield/price summary
   *
   * Trading:
   *   company/security + transaction summary
   */

  const summary = options.summary || "";

  /*
   * Cards without details don't need an expandable toggle.
   */

  const hasDetails = options.expandable !== false && Boolean(fields);

  if (!hasDetails) {
    return `
      <article
        class="${escapeHtml(cardClassName)}"
        data-data-card
      >
        <div class="${escapeHtml(mainClassName)}">
          ${summary}
        </div>
      </article>
    `.trim();
  }

  return `
    <article
      class="${escapeHtml(cardClassName)}"
      data-data-card
    >
      <div class="${escapeHtml(mainClassName)}">
        ${summary}
      </div>

      <div
        class="${escapeHtml(detailsClassName)}"
        id="${escapeHtml(detailsId)}"
        data-data-card-details
        hidden
      >
        <dl class="${escapeHtml(fieldsClassName)}">
          ${fields}
        </dl>
      </div>

      <button
        type="button"
        class="${escapeHtml(toggleClassName)}"
        aria-expanded="false"
        aria-controls="${escapeHtml(detailsId)}"
        data-data-card-toggle
      >
        <span
          class="data-card__toggle-label"
          data-data-card-toggle-label
          data-more-label="${escapeHtml(moreLabel)}"
          data-less-label="${escapeHtml(lessLabel)}"
        >
          ${escapeHtml(moreLabel)}
        </span>

        <span
          class="has-icon icon-chevron-down"
          aria-hidden="true"
        ></span>
      </button>
    </article>
  `.trim();
}
