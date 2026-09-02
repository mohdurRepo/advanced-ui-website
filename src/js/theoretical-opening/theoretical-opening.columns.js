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
      data: "companyName",
      title: labels.companyName || "",
      width: "40%",
      className: "text-start",
    },

    {
      id: "previousClose",
      data: "previousClose",
      title: labels.previousClose || "",
      width: "20%",
      className: "text-center",
    },

    {
      id: "top",
      data: "top",
      title: labels.top || "",
      width: "20%",
      className: "text-center",
    },

    {
      id: "tov",
      data: "tov",
      title: labels.tov || "",
      width: "20%",
      className: "text-center",
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
