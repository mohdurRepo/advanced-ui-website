/* ==========================================================================
   Theoretical Opening Columns
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - define the canonical desktop table schema
 * - provide localized column labels
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Constants
   ========================================================================== */

export const THEORETICAL_OPENING_VIEW = "default";

/* ==========================================================================
   Schema
   ========================================================================== */

function createColumns(config) {
  const labels = config.labels?.table || {};

  return [
    {
      id: "companyName",

      /*
       * Company identity needs the complete row:
       *
       * - company logo
       * - company name
       * - company code
       * - company URL
       */
      data: null,

      title: labels.companyName || "Company Name",

      width: "40%",

      className: "table-market__security",

      orderable: false,
    },

    {
      id: "previousClose",

      data: "previousClose",

      title: labels.previousClose || "Previous Close",

      width: "20%",

      className: "numeric text-center",

      orderable: false,
    },

    {
      id: "top",

      data: "top",

      title: labels.top || "TOP",

      width: "20%",

      className: "numeric text-center",

      orderable: false,
    },

    {
      id: "tov",

      data: "tov",

      title: labels.tov || "TOV",

      width: "20%",

      className: "numeric text-center",

      orderable: false,
    },
  ];
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function getColumns(config, view = THEORETICAL_OPENING_VIEW) {
  if (!config) {
    throw new TypeError("getColumns requires config.");
  }

  if (view !== THEORETICAL_OPENING_VIEW) {
    return [];
  }

  return createColumns(config);
}
