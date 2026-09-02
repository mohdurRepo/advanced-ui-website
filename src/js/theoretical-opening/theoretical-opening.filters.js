/* ==========================================================================
   Theoretical Opening Filters
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - configure the sector filter
 * - normalize the selected sector value
 * - expose the common Data Filters instance
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataFilters } from "../../common/data-view/index.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_SECTOR = "All";

/* ==========================================================================
   Helpers
   ========================================================================== */

function getSectorSelector(variant) {
  return variant === "nomu"
    ? "[data-nomu-theoretical-opening-sector]"
    : "[data-theoretical-opening-sector]";
}

function normalizeSector(value) {
  const sector = String(value ?? "").trim();

  return sector || DEFAULT_SECTOR;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createTheoreticalOpeningFilters({
  root = document,
  variant = "main",
} = {}) {
  return createDataFilters({
    root,

    fields: {
      sector: {
        selector: getSectorSelector(variant),

        required: true,

        normalize: normalizeSector,

        effect: "reload",
      },
    },
  });
}
