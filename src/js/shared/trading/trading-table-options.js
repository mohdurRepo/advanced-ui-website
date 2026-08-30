/* ==========================================================================
   Trading Table Options
   ========================================================================== */

/*
 * Shared DataTables defaults for Issuer Trading.
 *
 * Responsibilities:
 *
 * - provide consistent DataTables behavior
 * - enable horizontal scrolling
 * - enable one FixedHeader implementation
 * - disable DataTables UI owned by the data-view system
 * - allow individual tab views to override business-specific options
 *
 * Individual views still own:
 *
 * - columns
 * - ordering rules
 * - paging decisions
 * - row grouping
 * - created-row behavior
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

const DEFAULT_FIXED_HEADER = Object.freeze({
  header: true,
  footer: false,
});

const DEFAULT_TABLE_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,
  pageLength: 25,
  lengthMenu: Object.freeze([25, 50, 100]),

  searching: false,
  ordering: false,
  info: false,
  lengthChange: false,

  serverSide: false,
  processing: false,

  scrollX: true,
  scrollCollapse: true,

  fixedHeader: DEFAULT_FIXED_HEADER,
  fixedColumns: false,

  rowGroup: false,

  deferRender: true,
  responsive: false,
  stateSave: false,

  layout: DEFAULT_LAYOUT,
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

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }

  return value;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function mergeNestedOption(defaults, overrides, key) {
  if (!hasOwn(overrides, key)) {
    return cloneValue(defaults[key]);
  }

  const defaultValue = defaults[key];

  const overrideValue = overrides[key];

  if (isPlainObject(defaultValue) && isPlainObject(overrideValue)) {
    return {
      ...cloneValue(defaultValue),
      ...cloneValue(overrideValue),
    };
  }

  return cloneValue(overrideValue);
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createTradingTableOptions(overrides = {}) {
  if (!isPlainObject(overrides)) {
    throw new TypeError("Trading table overrides must be an object.");
  }

  const options = {
    ...cloneValue(DEFAULT_TABLE_OPTIONS),
    ...cloneValue(overrides),
  };

  options.layout = mergeNestedOption(
    DEFAULT_TABLE_OPTIONS,
    overrides,
    "layout",
  );

  options.fixedHeader = mergeNestedOption(
    DEFAULT_TABLE_OPTIONS,
    overrides,
    "fixedHeader",
  );

  options.fixedColumns = mergeNestedOption(
    DEFAULT_TABLE_OPTIONS,
    overrides,
    "fixedColumns",
  );

  return options;
}
