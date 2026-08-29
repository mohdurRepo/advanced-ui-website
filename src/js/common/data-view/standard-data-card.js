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
 * - create safe details IDs
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
   State
   ========================================================================== */

/*
 * Used only when a caller does not provide a row ID, details ID, or index.
 */

let generatedDetailsId = 0;

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

function createSafeId(value, fallback = "item") {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function createGeneratedIdentity() {
  generatedDetailsId += 1;

  return `generated-${generatedDetailsId}`;
}

function normalizeFields(fields = []) {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.filter(isObject);
}

function createClassName(...classNames) {
  return classNames
    .flat()
    .map((className) => String(className ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Field Rendering
   ========================================================================== */

export function renderStandardDataCardField(field = {}) {
  if (!isObject(field)) {
    return "";
  }

  const {
    label = "",
    value = "",
    className = "",
    labelClassName = "",
    valueClassName = "",
    fullWidth = false,
    numeric = false,
  } = field;

  const fieldClasses = createClassName(
    "data-card__field",

    fullWidth ? "data-card__field--full" : "",

    className,
  );

  const labelClasses = createClassName(
    "data-card__label",

    labelClassName,
  );

  const valueClasses = createClassName(
    "data-card__value",

    numeric ? "data-card__value--numeric" : "",

    valueClassName,
  );

  /*
   * `value` is rendered markup supplied by the calling formatter.
   *
   * The calling formatter remains responsible for escaping plain data before
   * including it in rendered markup.
   */

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
  return normalizeFields(fields)
    .map(renderStandardDataCardField)
    .filter(Boolean)
    .join("");
}

/* ==========================================================================
   Toggle Labels
   ========================================================================== */

function getToggleLabels(options) {
  const moreLabel =
    String(options.moreLabel || "More details").trim() || "More details";

  const lessLabel =
    String(options.lessLabel || "Less details").trim() || "Less details";

  return Object.freeze({
    moreLabel,

    lessLabel,
  });
}

/* ==========================================================================
   Details ID
   ========================================================================== */

function getDetailsIdentity(options) {
  if (
    options.rowId !== undefined &&
    options.rowId !== null &&
    String(options.rowId).trim()
  ) {
    return options.rowId;
  }

  /*
   * Nullish comparison is intentional. Index zero is a valid identity.
   */

  if (options.index !== undefined && options.index !== null) {
    return options.index;
  }

  return createGeneratedIdentity();
}

function getDetailsId(options) {
  if (options.detailsId) {
    return createSafeId(
      options.detailsId,

      `data-card-details-${createGeneratedIdentity()}`,
    );
  }

  const prefix = createSafeId(
    options.idPrefix || "data-card-details",

    "data-card-details",
  );

  const identity = createSafeId(
    getDetailsIdentity(options),

    createGeneratedIdentity(),
  );

  return `${prefix}-${identity}`;
}

/* ==========================================================================
   Static Card
   ========================================================================== */

/*
 * Static cards deliberately do not receive `data-data-card`.
 *
 * That attribute is a behavior hook owned by the design-system DataViewCard
 * component. Every element carrying it must contain:
 *
 * - [data-data-card-toggle]
 * - [data-data-card-details]
 */

function renderStaticCard({ cardClassName, mainClassName, summary }) {
  return `
    <article class="${escapeHtml(cardClassName)}">
      <div class="${escapeHtml(mainClassName)}">
        ${summary}
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Expandable Card
   ========================================================================== */

function renderExpandableCard({
  cardClassName,
  mainClassName,
  detailsClassName,
  fieldsClassName,
  toggleClassName,
  detailsId,
  fields,
  summary,
  moreLabel,
  lessLabel,
}) {
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

/* ==========================================================================
   Public Renderer
   ========================================================================== */

export function renderStandardDataCard(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("renderStandardDataCard requires an options object.");
  }

  const cardClassName = createClassName(
    "data-card",

    options.className,
  );

  const mainClassName = createClassName(
    "data-card__main",

    options.mainClassName,
  );

  /*
   * `summary` is raw rendered markup supplied by the page module.
   *
   * Examples:
   *
   * - Market Watch: identity and quote
   * - Sukuk: security identity and yield/price
   * - Trading: company identity and transaction summary
   */

  const summary = options.summary || "";

  const fields = renderStandardDataCardFields(options.fields);

  const hasDetails = options.expandable !== false && Boolean(fields);

  if (!hasDetails) {
    return renderStaticCard({
      cardClassName,

      mainClassName,

      summary,
    });
  }

  const detailsClassName = createClassName(
    "data-card__details",

    options.detailsClassName,
  );

  const fieldsClassName = createClassName(
    "data-card__fields",

    options.fieldsClassName,
  );

  const toggleClassName = createClassName(
    "data-card__toggle",

    options.toggleClassName,
  );

  const detailsId = getDetailsId(options);

  const { moreLabel, lessLabel } = getToggleLabels(options);

  return renderExpandableCard({
    cardClassName,

    mainClassName,

    detailsClassName,

    fieldsClassName,

    toggleClassName,

    detailsId,

    fields,

    summary,

    moreLabel,

    lessLabel,
  });
}
