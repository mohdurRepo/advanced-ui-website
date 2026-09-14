/* ==========================================================================
   Sukuk Filters
   ========================================================================== */

/*
 * Sukuk & Bonds filter configuration.
 *
 * Responsibilities:
 *
 * - define Sukuk filter selectors
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

import { createDataFilters } from "../../common/data-view/index.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const SUKUK_FILTER_SELECTORS = Object.freeze({
  bondType: "[data-sukuk-bond-type]",
});

/* ==========================================================================
   Value Normalization
   ========================================================================== */

export function normalizeSukukBondType(value) {
  const normalized = String(value ?? "").trim();

  return normalized || "all";
}

/* ==========================================================================
   Filter Fields
   ========================================================================== */

export function getSukukFilterFields() {
  return {
    bondType: {
      selector: SUKUK_FILTER_SELECTORS.bondType,

      effect: "reload",

      normalize: normalizeSukukBondType,
    },
  };
}

/* ==========================================================================
   Filter Controller
   ========================================================================== */

export function createSukukFilters({ root = document } = {}) {
  return createDataFilters({
    root,

    fields: getSukukFilterFields(),
  });
}
