/* ==========================================================================
   Theoretical Opening Table Options
   ========================================================================== */

/*
 * Shared between:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
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

export const THEORETICAL_OPENING_TABLE_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,

  pageLength: 25,

  lengthChange: false,

  searching: false,

  ordering: false,

  info: false,

  serverSide: false,

  processing: false,

  responsive: false,

  deferRender: true,

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
   Factory
   ========================================================================== */

export function createTheoreticalOpeningTableOptions(overrides = {}) {
  const normalizedOverrides = getDefinedOverrides(overrides);

  const { layout: layoutOverrides, ...optionOverrides } = normalizedOverrides;

  const normalizedLayout =
    layoutOverrides &&
    typeof layoutOverrides === "object" &&
    !Array.isArray(layoutOverrides)
      ? getDefinedOverrides(layoutOverrides)
      : {};

  return {
    ...THEORETICAL_OPENING_TABLE_OPTIONS,

    ...optionOverrides,

    layout: {
      ...DEFAULT_LAYOUT,
      ...normalizedLayout,
    },
  };
}
