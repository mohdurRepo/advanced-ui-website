/* ==========================================================================
   Financial Calendar Table Options
   ========================================================================== */

/*
 * Financial Calendar defaults for the shared Data Table component.
 *
 * Responsibilities:
 *
 * - provide safe client-side DataTables defaults
 * - preserve horizontal scrolling for wide calendar tables
 * - disable DataTables Responsive because mobile uses separate cards
 * - merge tab-specific paging, ordering, layout, and callback options
 * - return a new options object for every table instance
 *
 * Generic table creation and lifecycle behavior remain owned by
 * common/data-view.
 *
 * This module intentionally has no dependency on Issuer Trading.
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULT_LAYOUT = Object.freeze({
  topStart: null,

  topEnd: null,

  bottomStart: null,

  bottomEnd: null,
});

const DEFAULT_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,

  searching: false,

  ordering: false,

  info: false,

  lengthChange: false,

  serverSide: false,

  processing: false,

  scrollX: true,

  scrollCollapse: true,

  fixedHeader: false,

  fixedColumns: false,

  responsive: false,

  rowGroup: false,

  deferRender: true,
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function cloneArray(value) {
  return Array.isArray(value)
    ? value.map((item) => (Array.isArray(item) ? [...item] : item))
    : value;
}

function createLayout(value) {
  if (!isPlainObject(value)) {
    return {
      ...DEFAULT_LAYOUT,
    };
  }

  return {
    ...DEFAULT_LAYOUT,

    ...value,
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createFinancialCalendarTableOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createFinancialCalendarTableOptions requires an options object.",
    );
  }

  const tableOptions = {
    ...DEFAULT_OPTIONS,

    ...options,

    layout: createLayout(options.layout),
  };

  /*
   * Return private array copies for configuration commonly represented by
   * arrays. This prevents one table or DataTables itself from mutating
   * another tab's configuration.
   */

  if (Array.isArray(options.lengthMenu)) {
    tableOptions.lengthMenu = cloneArray(options.lengthMenu);
  }

  if (Array.isArray(options.order)) {
    tableOptions.order = cloneArray(options.order);
  }

  if (Array.isArray(options.columnDefs)) {
    tableOptions.columnDefs = options.columnDefs.map((definition) =>
      isPlainObject(definition) ? { ...definition } : definition,
    );
  }

  if (isPlainObject(options.language)) {
    tableOptions.language = {
      ...options.language,
    };
  }

  return tableOptions;
}
