/* ==========================================================================
   Theoretical Opening Columns
   ========================================================================== */

/*
 * Single source of truth for Theoretical Opening columns.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_VIEW = "1";

const WIDTHS = Object.freeze({
  companyName: "40%",
  previousClose: "20%",
  top: "20%",
  tov: "20%",
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
   Columns
   ========================================================================== */

function createColumns(config = {}) {
  const labels = getLabels(config);

  return [
    sizedColumn(WIDTHS.companyName, {
      key: "companyName",

      label: cleanLabel(labels.companyName || labels.company, "Company"),

      data: "companyName",

      type: "company",

      className: "table-market__security",

      mobile: false,
    }),

    sizedColumn(WIDTHS.previousClose, {
      key: "previousClose",

      label: cleanLabel(labels.previousClose, "Previous Close"),

      data: "previousClose",

      type: "price",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.top, {
      key: "top",

      label: cleanLabel(labels.top, "TOP"),

      data: "top",

      type: "price",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.tov, {
      key: "tov",

      label: cleanLabel(labels.tov, "TOV"),

      data: "tov",

      type: "quantity",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Public API
   ========================================================================== */

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
