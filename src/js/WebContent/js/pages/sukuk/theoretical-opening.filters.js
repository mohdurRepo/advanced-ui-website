/* ==========================================================================
   Theoretical Opening Filters
   ========================================================================== */

/*
 * Theoretical Opening filter configuration.
 *
 * Responsibilities:
 *
 * - define Theoretical Opening filter selectors
 * - define filter normalization
 * - define filter effects
 * - create the common Data View filter controller
 *
 * This module intentionally has no:
 *
 * - request execution
 * - API response normalization
 * - DataTables lifecycle
 * - column visibility
 * - card rendering
 * - page startup
 */

import { createDataFilters } from "../common/data-view/index.js";

/*
 * ==========================================================================
 * Constants
 * ==========================================================================
 */

export const THEORETICAL_OPENING_FILTER_SELECTORS = Object.freeze({
  sector: "[data-theoretical-opening-sector]",
});

/*
 * ==========================================================================
 * Value Normalization
 * ==========================================================================
 */

export function normalizeTheoreticalOpeningSector(value) {
  const normalized = String(value ?? "").trim();

  return normalized || "All";
}

/*
 * ==========================================================================
 * Filter Fields
 * ==========================================================================
 */

export function getTheoreticalOpeningFilterFields() {
  return {
    sector: {
      selector: THEORETICAL_OPENING_FILTER_SELECTORS.sector,

      effect: "reload",

      normalize: normalizeTheoreticalOpeningSector,
    },
  };
}

/*
 * ==========================================================================
 * Filter Controller
 * ==========================================================================
 */

export function createTheoreticalOpeningFilters({ root = document } = {}) {
  return createDataFilters({
    root,

    fields: getTheoreticalOpeningFilterFields(),
  });
}
