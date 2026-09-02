/* ==========================================================================
   Theoretical Opening Filters
   ========================================================================== */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataFilters } from "../common/data-view/index.js";

/* ==========================================================================
   Selectors
   ========================================================================== */

export const THEORETICAL_OPENING_FILTER_SELECTORS = Object.freeze({
  sector: "[data-theoretical-opening-sector]",
});

/* ==========================================================================
   Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningSector(value) {
  const normalized = String(value ?? "").trim();

  return normalized || "All";
}

/* ==========================================================================
   Filter Fields
   ========================================================================== */

export function getTheoreticalOpeningFilterFields() {
  return {
    sector: {
      selector: THEORETICAL_OPENING_FILTER_SELECTORS.sector,

      effect: "reload",

      normalize: normalizeTheoreticalOpeningSector,
    },
  };
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createTheoreticalOpeningFilters({ root = document } = {}) {
  return createDataFilters({
    root,

    fields: getTheoreticalOpeningFilterFields(),
  });
}
