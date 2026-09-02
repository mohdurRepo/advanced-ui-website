/* ==========================================================================
   Theoretical Opening Columns
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_VIEW = "1";

const GROUP_ORDER = Object.freeze(["previous-close", "top", "tov"]);

const WIDTHS = Object.freeze({
  company: "15.5rem",
  previousClose: "9rem",
  top: "8rem",
  tov: "8rem",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLabels(config = {}) {
  return config.labels?.table || {};
}

function column(definition = {}) {
  return {
    mobile: true,
    ...definition,
  };
}

function sizedColumn(width, definition = {}) {
  return column({
    width,
    ...definition,
  });
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

function createGroups(config = {}) {
  const labels = getLabels(config);

  return {
    "previous-close": {
      id: "previous-close",

      label: cleanLabel(labels.previousClose, "Previous Close"),
    },

    top: {
      id: "top",

      label: cleanLabel(labels.top, "TOP"),
    },

    tov: {
      id: "tov",

      label: cleanLabel(labels.tov, "TOV"),
    },
  };
}

/* ==========================================================================
   Columns
   ========================================================================== */

function createColumns(config = {}) {
  const labels = getLabels(config);

  return [
    sizedColumn(WIDTHS.company, {
      key: "companyName",

      label: cleanLabel(labels.companyName || labels.company, "Company"),

      data: "companyName",

      type: "company",

      className: "table-market__security",

      /*
       * Company identity is always visible.
       * It is not controlled by Show Columns.
       */

      mobile: false,
    }),

    sizedColumn(WIDTHS.previousClose, {
      key: "previousClose",

      label: cleanLabel(labels.previousClose, "Previous Close"),

      data: "previousClose",

      type: "price",

      group: "previous-close",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.top, {
      key: "top",

      label: cleanLabel(labels.top, "TOP"),

      data: "top",

      type: "price",

      group: "top",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.tov, {
      key: "tov",

      label: cleanLabel(labels.tov, "TOV"),

      data: "tov",

      type: "quantity",

      group: "tov",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function getColumnGroups(config = {}, view = DEFAULT_VIEW) {
  void view;

  const groups = createGroups(config);

  return GROUP_ORDER.map((groupId) => groups[groupId]).filter(Boolean);
}

export function getDefaultVisibleGroups() {
  return [...GROUP_ORDER];
}

export function getColumns(config = {}, view = DEFAULT_VIEW) {
  void view;

  return createColumns(config);
}

export function getMobileColumns(config = {}, view = DEFAULT_VIEW) {
  return getColumns(config, view).filter((item) => item.mobile !== false);
}

export function getColumnByKey(config = {}, view = DEFAULT_VIEW, key) {
  return getColumns(config, view).find((item) => item.key === key) || null;
}
