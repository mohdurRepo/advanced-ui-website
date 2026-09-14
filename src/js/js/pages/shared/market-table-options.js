/* ==========================================================================
   Shared Market Table Options
   ========================================================================== */

/*
 * Common DataTables defaults shared by:
 *
 * - Market Watch
 * - Sukuk & Bonds
 *
 * Responsibilities:
 *
 * - provide consistent DataTables defaults
 * - allow page-level overrides
 * - safely merge layout configuration
 * - ignore null / undefined overrides
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - column definitions
 * - row grouping rules
 * - cell rendering
 * - page-specific behavior
 * - DataTables lifecycle
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LAYOUT = Object.freeze({
  topStart: null,
  topEnd: null,
  bottomStart: null,
  bottomEnd: null,
});

export const MARKET_TABLE_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,
  pageLength: 25,
  lengthChange: false,

  searching: false,
  ordering: false,
  info: false,

  serverSide: false,
  processing: false,

  scrollX: true,
  scrollCollapse: true,

  fixedHeader: true,
  fixedColumns: 1,

  layout: DEFAULT_LAYOUT,
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function getDefinedOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(overrides).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  );
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createMarketTableOptions(overrides = {}) {
  const normalizedOverrides = getDefinedOverrides(overrides);

  const { layout: layoutOverrides, ...optionOverrides } = normalizedOverrides;

  const normalizedLayout =
    layoutOverrides &&
    typeof layoutOverrides === "object" &&
    !Array.isArray(layoutOverrides)
      ? getDefinedOverrides(layoutOverrides)
      : {};

  return {
    ...MARKET_TABLE_OPTIONS,

    ...optionOverrides,

    layout: {
      ...DEFAULT_LAYOUT,
      ...normalizedLayout,
    },
  };
}
