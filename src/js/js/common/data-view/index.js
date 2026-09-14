/* ==========================================================================
   Data View Common API
   ========================================================================== */

/*
 * Public entry point for reusable data-view application utilities.
 *
 * Page modules should import reusable functionality from this file rather
 * than depending directly on implementation files.
 */

/* ==========================================================================
   State
   ========================================================================== */

export { createDataState } from "./data-state.js";

/* ==========================================================================
   Data Source
   ========================================================================== */

export { createDataSource } from "./data-source.js";

/* ==========================================================================
   Watchlist
   ========================================================================== */

export {
  applyWatchlistFilter,
  filterWatchlisted,
  getWatchlistValue,
  isWatchlisted,
  isWatchlistedValue,
} from "./data-watchlist.js";

/* ==========================================================================
   Column Visibility
   ========================================================================== */

export { createDataColumnVisibility } from "./data-column-visibility.js";

/* ==========================================================================
   Column Picker
   ========================================================================== */

export { createDataColumnPicker } from "./data-column-picker.js";

/* ==========================================================================
   Table
   ========================================================================== */

export { createDataTable } from "./data-table.js";

/* ==========================================================================
   Cards
   ========================================================================== */

export { createDataCards } from "./data-cards.js";

/* ==========================================================================
   Standard Data Card
   ========================================================================== */

export {
  renderStandardDataCard,
  renderStandardDataCardField,
  renderStandardDataCardFields,
} from "./standard-data-card.js";

/* ==========================================================================
   Standard Company Identity
   ========================================================================== */

export {
  bindStandardCompanyLogoFallback,
  getStandardCompanyCode,
  getStandardCompanyLogoFallbackUrl,
  getStandardCompanyLogoUrl,
  getStandardCompanyName,
  getStandardCompanyUrl,
  handleStandardCompanyLogoError,
  renderStandardCompanyCardIdentity,
  renderStandardCompanyCell,
  renderStandardCompanyLogo,
} from "./standard-company-identity.js";

/* ==========================================================================
   Filters
   ========================================================================== */

export { createDataFilters } from "./data-filters.js";

/* ==========================================================================
   Results
   ========================================================================== */

export { createDataResults } from "./data-results.js";

/* ==========================================================================
   Controller
   ========================================================================== */

export { createDataViewController } from "./data-view-controller.js";
