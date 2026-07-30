import {
  ARIA,
  ATTRIBUTES,
  CLASSES,
  DEFAULTS,
  DISPLAY_MODES,
  SELECTORS,
} from "./custom-select.constants";

/* ==========================================================================
   Custom Select: Utilities
   ========================================================================== */

export function isHTMLElement(element) {
  return element instanceof HTMLElement;
}

export function isInputElement(element) {
  return element instanceof HTMLInputElement;
}

export function isSearchInput(element) {
  return isInputElement(element) && element.type === "search";
}

function getAttributeValue(element, attribute) {
  return element.getAttribute(attribute)?.trim() || "";
}

export function getSelectConfig(select) {
  const requestedDisplay = getAttributeValue(select, ATTRIBUTES.display);

  const display = Object.values(DISPLAY_MODES).includes(requestedDisplay)
    ? requestedDisplay
    : DISPLAY_MODES.tags;

  return Object.freeze({
    multiple: select.hasAttribute(ATTRIBUTES.multiple),
    searchable: select.hasAttribute(ATTRIBUTES.searchable),
    clearable: select.hasAttribute(ATTRIBUTES.clearable),
    display,
    placeholder:
      getAttributeValue(select, ATTRIBUTES.placeholder) || DEFAULTS.placeholder,
  });
}

export function getSelectElements(select) {
  return {
    control: select.querySelector(SELECTORS.control),
    trigger: select.querySelector(SELECTORS.trigger),
    value: select.querySelector(SELECTORS.value),
    panel: select.querySelector(SELECTORS.panel),
    listbox: select.querySelector(SELECTORS.listbox),
    search: select.querySelector(SELECTORS.search),
    empty: select.querySelector(SELECTORS.empty),
    input: select.querySelector(SELECTORS.input),
    clearButtons: Array.from(select.querySelectorAll(SELECTORS.clear)),
    selectAllButton: select.querySelector(SELECTORS.selectAll),
    cancelButton: select.querySelector(SELECTORS.cancel),
    applyButton: select.querySelector(SELECTORS.apply),
    selectionSummary: select.querySelector(SELECTORS.selectionSummary),
  };
}

export function getOptions(select) {
  return Array.from(select.querySelectorAll(SELECTORS.option));
}

export function getCheckboxOptions(select) {
  return Array.from(select.querySelectorAll(SELECTORS.checkboxOption));
}

export function getCheckboxes(select) {
  return Array.from(select.querySelectorAll(SELECTORS.checkbox)).filter(
    isInputElement,
  );
}

export function getFilterableOptions(select, config) {
  return config.multiple ? getCheckboxOptions(select) : getOptions(select);
}

export function getOptionLabel(option) {
  return (
    option.querySelector(SELECTORS.optionLabel)?.textContent?.trim() ||
    option.textContent?.trim() ||
    ""
  );
}

export function getOptionValue(option) {
  return option.getAttribute(ATTRIBUTES.value) || "";
}

export function getCheckboxLabel(checkbox) {
  const option = checkbox.closest(SELECTORS.checkboxOption);

  return (
    option?.querySelector(SELECTORS.optionLabel)?.textContent?.trim() ||
    option?.querySelector(SELECTORS.formCheckLabel)?.textContent?.trim() ||
    checkbox.value
  );
}

export function getSelectedCheckboxes(select) {
  return getCheckboxes(select).filter((checkbox) => checkbox.checked);
}

export function getSelectedCheckboxValues(select) {
  return getSelectedCheckboxes(select).map((checkbox) => checkbox.value);
}

export function getSelectedCheckboxLabels(select) {
  return getSelectedCheckboxes(select).map(getCheckboxLabel);
}

export function isSelectOpen(select) {
  return select.classList.contains(CLASSES.open);
}

export function isSelectDisabled(select, trigger) {
  return (
    select.classList.contains(CLASSES.disabled) ||
    select.getAttribute(ARIA.disabled) === "true" ||
    trigger?.disabled === true
  );
}

export function isSelectReadonly(select) {
  return (
    select.classList.contains(CLASSES.readonly) ||
    select.getAttribute(ARIA.readonly) === "true"
  );
}

export function isSelectLoading(select) {
  return (
    select.classList.contains(CLASSES.loading) ||
    select.getAttribute(ARIA.busy) === "true"
  );
}

export function setHasValue(select, hasValue) {
  select.classList.toggle(CLASSES.hasValue, hasValue);
}

export function isOptionDisabled(option) {
  return (
    option.classList.contains(CLASSES.disabled) ||
    option.getAttribute(ARIA.disabled) === "true"
  );
}

export function isCheckboxOptionDisabled(option) {
  const checkbox = option.querySelector(SELECTORS.checkbox);

  return (
    option.classList.contains(CLASSES.disabled) ||
    (isInputElement(checkbox) && checkbox.disabled)
  );
}

export function getNavigableOptions(select, config) {
  const options = config.multiple
    ? getCheckboxOptions(select)
    : getOptions(select);

  return options.filter((option) => {
    if (option.hidden) {
      return false;
    }

    return config.multiple
      ? !isCheckboxOptionDisabled(option)
      : !isOptionDisabled(option);
  });
}

export function setOptionSelected(option, selected) {
  option.classList.toggle(CLASSES.selected, selected);
  option.setAttribute(ARIA.selected, String(selected));
}

export function getSelectedOption(select) {
  return (
    getOptions(select).find(
      (option) =>
        option.getAttribute(ARIA.selected) === "true" ||
        option.classList.contains(CLASSES.selected),
    ) || null
  );
}

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase();
}

export function matchesSearchQuery(option, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchText(option.textContent).includes(normalizedQuery);
}

export function dispatchNativeChange(element) {
  if (!isHTMLElement(element)) {
    return;
  }

  element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

export function dispatchSelectEvent(select, eventName, detail = {}) {
  select.dispatchEvent(
    new CustomEvent(eventName, {
      bubbles: true,
      detail,
    }),
  );
}

let generatedOptionId = 0;

function createOptionId() {
  let id;

  do {
    generatedOptionId += 1;
    id = `${DEFAULTS.optionIdPrefix}-${generatedOptionId}`;
  } while (document.getElementById(id));

  return id;
}

export function ensureOptionId(option) {
  if (!option.id) {
    option.id = createOptionId();
  }

  return option.id;
}
