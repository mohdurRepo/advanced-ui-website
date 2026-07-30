/* ==========================================================================
   Class Names
   ========================================================================== */

export const CLASS_NAMES = Object.freeze({
  component: "custom-select",
  multiple: "custom-select--multiple",

  fallback: "custom-select__fallback",
  native: "custom-select__native",
  interface: "custom-select__interface",
  control: "custom-select__control",
  trigger: "custom-select__trigger",
  value: "custom-select__value",
  indicator: "custom-select__indicator",
  clear: "custom-select__clear",

  popover: "custom-select__popover",

  search: "custom-select__search",
  searchField: "custom-select__search-field",
  searchInput: "custom-select__search-input",
  searchIcon: "custom-select__search-icon",
  searchClear: "custom-select__search-clear",

  listbox: "custom-select__listbox",
  group: "custom-select__group",
  groupLabel: "custom-select__group-label",
  option: "custom-select__option",
  optionLabel: "custom-select__option-label",
  optionCheck: "custom-select__option-check",
  match: "custom-select__match",
  empty: "custom-select__empty",

  tags: "custom-select__tags",
  tag: "custom-select__tag",
  tagLabel: "custom-select__tag-label",
  tagOverflow: "custom-select__tag-overflow",
  selectionCount: "custom-select__selection-count",

  enhanced: "is-enhanced",
  enhancementFailed: "is-enhancement-failed",
  open: "is-open",
  openUp: "is-open-up",
  positioned: "is-positioned",
  closing: "is-closing",
  active: "is-active",
  selected: "is-selected",
  disabled: "is-disabled",
  loading: "is-loading",
  placeholder: "is-placeholder",
  hasValue: "has-value",
  hasQuery: "has-query",
  nativeFocused: "is-native-focused",
  hasSelectionCount: "has-selection-count",
});

/* ==========================================================================
   Selectors
   ========================================================================== */

const classSelector = (name) => `.${CLASS_NAMES[name]}`;

export const SELECTORS = Object.freeze({
  component: "[data-custom-select]",

  fallback: classSelector("fallback"),
  native: classSelector("native"),
  interface: classSelector("interface"),
  control: classSelector("control"),
  trigger: classSelector("trigger"),
  value: classSelector("value"),
  indicator: classSelector("indicator"),
  clear: classSelector("clear"),

  popover: classSelector("popover"),

  search: classSelector("search"),
  searchInput: classSelector("searchInput"),
  searchClear: classSelector("searchClear"),

  listbox: classSelector("listbox"),
  group: classSelector("group"),
  option: classSelector("option"),
  optionLabel: classSelector("optionLabel"),
  empty: classSelector("empty"),

  enabledOption: `.${CLASS_NAMES.option}:not([aria-disabled="true"], .${CLASS_NAMES.disabled}, [hidden])`,

  form: "form",
});

/* ==========================================================================
   Data Attributes
   ========================================================================== */

export const DATA_ATTRIBUTES = Object.freeze({
  component: "data-custom-select",
  searchable: "data-searchable",
  clearable: "data-clearable",
  placeholder: "data-placeholder",

  searchPlaceholder: "data-search-placeholder",
  emptyMessage: "data-empty-message",
  clearLabel: "data-clear-label",
  action: "data-action",

  placement: "data-placement",
  active: "data-active",
});

/* ==========================================================================
   ARIA Attributes
   ========================================================================== */

export const ARIA = Object.freeze({
  activeDescendant: "aria-activedescendant",
  busy: "aria-busy",
  controls: "aria-controls",
  describedBy: "aria-describedby",
  disabled: "aria-disabled",
  expanded: "aria-expanded",
  hasPopup: "aria-haspopup",
  hidden: "aria-hidden",
  invalid: "aria-invalid",
  label: "aria-label",
  labelledBy: "aria-labelledby",
  live: "aria-live",
  multiSelectable: "aria-multiselectable",
  selected: "aria-selected",
});

/* ==========================================================================
   Keyboard
   ========================================================================== */

export const KEYS = Object.freeze({
  arrowDown: "ArrowDown",
  arrowUp: "ArrowUp",
  end: "End",
  enter: "Enter",
  escape: "Escape",
  home: "Home",
  pageDown: "PageDown",
  pageUp: "PageUp",
  space: " ",
  tab: "Tab",
});

/* ==========================================================================
   Events
   ========================================================================== */

export const DOM_EVENTS = Object.freeze({
  blur: "blur",
  change: "change",
  click: "click",
  focus: "focus",
  input: "input",
  keydown: "keydown",
  pointerdown: "pointerdown",
  reset: "reset",
  resize: "resize",
  scroll: "scroll",
});

/**
 * The change event name remains compatible with the legacy form-select API.
 * Open and close events follow the same design-system namespace.
 */

export const COMPONENT_EVENTS = Object.freeze({
  beforeOpen: "form:select-before-open",
  open: "form:select-open",
  close: "form:select-close",
  change: "form:select-change",
});

/* ==========================================================================
   Placement
   ========================================================================== */

export const PLACEMENTS = Object.freeze({
  bottom: "bottom-start",
  top: "top-start",
});

/* ==========================================================================
   Defaults
   ========================================================================== */

export const DEFAULTS = Object.freeze({
  closeDuration: 140,
  typeaheadDelay: 700,
});
