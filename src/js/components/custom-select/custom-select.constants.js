/* ==========================================================================
   Custom Select: Constants
   ========================================================================== */

export const SELECTORS = Object.freeze({
  root: "[data-custom-select]",
  control: ".custom-select__control",
  trigger: "[data-custom-select-trigger]",
  value: "[data-custom-select-value]",
  panel: "[data-custom-select-panel]",
  listbox: "[data-custom-select-listbox]",
  option: "[data-custom-select-option]",
  optionLabel: ".custom-select__option-label",
  group: ".custom-select__group",
  checkboxOption: ".custom-select__checkbox-option",
  search: "[data-custom-select-search]",
  empty: "[data-custom-select-empty]",
  input: "[data-custom-select-input]",
  checkbox: "[data-custom-select-checkbox]",
  clear: "[data-custom-select-clear]",
  selectAll: "[data-custom-select-select-all]",
  cancel: "[data-custom-select-cancel]",
  apply: "[data-custom-select-apply]",
  selectionSummary: "[data-custom-select-selection-summary]",
  formCheckLabel: ".form-check-label",
});

export const ATTRIBUTES = Object.freeze({
  multiple: "data-custom-select-multiple",
  searchable: "data-custom-select-searchable",
  clearable: "data-custom-select-clearable",
  display: "data-custom-select-display",
  placeholder: "data-custom-select-placeholder",
  value: "data-value",
});

export const ARIA = Object.freeze({
  activeDescendant: "aria-activedescendant",
  busy: "aria-busy",
  disabled: "aria-disabled",
  expanded: "aria-expanded",
  readonly: "aria-readonly",
  selected: "aria-selected",
});

export const CLASSES = Object.freeze({
  open: "is-open",
  selected: "is-selected",
  active: "is-active",
  disabled: "is-disabled",
  readonly: "is-readonly",
  loading: "is-loading",
  hasValue: "has-value",
  placeholder: "custom-select__value--placeholder",
  tag: "custom-select__tag",
  tagLabel: "custom-select__tag-label",
  summary: "custom-select__summary",
});

export const DISPLAY_MODES = Object.freeze({
  tags: "tags",
  summary: "summary",
});

export const KEYS = Object.freeze({
  arrowDown: "ArrowDown",
  arrowUp: "ArrowUp",
  end: "End",
  enter: "Enter",
  escape: "Escape",
  home: "Home",
  space: " ",
  tab: "Tab",
});

export const EVENTS = Object.freeze({
  open: "custom-select:open",
  close: "custom-select:close",
  change: "custom-select:change",
});

export const DEFAULTS = Object.freeze({
  placeholder: "Select an option",
  optionIdPrefix: "custom-select-option",
});
