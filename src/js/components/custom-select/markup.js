import { ARIA, CLASS_NAMES, DATA_ATTRIBUTES } from "./constants";
import {
  createElement,
  createUniqueId,
  ensureId,
  getAssociatedLabel,
  getOptionLabel,
  isOptionDisabled,
} from "./utils";

/* ==========================================================================
   Accessible Name
   ========================================================================== */

function createLabelReferences(native, valueId, idPrefix) {
  const explicitLabelledBy = native.getAttribute(ARIA.labelledBy)?.trim();
  const associatedLabel = getAssociatedLabel(native);
  const explicitLabel = native.getAttribute(ARIA.label)?.trim();

  let labelReference = explicitLabelledBy || "";
  let generatedLabel = null;

  if (!labelReference && associatedLabel) {
    labelReference = ensureId(associatedLabel, `${idPrefix}-label`);
  }

  if (!labelReference && explicitLabel) {
    generatedLabel = createElement(
      "span",
      {
        className: "visually-hidden",
        attributes: {
          id: createUniqueId(
            `${idPrefix}-accessible-label`,
            native.ownerDocument,
          ),
          dir: "auto",
        },
        text: explicitLabel,
      },
      native.ownerDocument,
    );

    labelReference = generatedLabel.id;
  }

  return {
    generatedLabel,
    labelReference,
    triggerLabelledBy: [labelReference, valueId].filter(Boolean).join(" "),
  };
}

/* ==========================================================================
   Options
   ========================================================================== */

function createOptionRecord(nativeOption, idPrefix, index) {
  const documentContext = nativeOption.ownerDocument;
  const disabled = isOptionDisabled(nativeOption);
  const selected = nativeOption.selected;

  const optionElement = createElement(
    "div",
    {
      className: [
        CLASS_NAMES.option,
        selected && CLASS_NAMES.selected,
        disabled && CLASS_NAMES.disabled,
      ],
      attributes: {
        id: createUniqueId(`${idPrefix}-option-${index + 1}`, documentContext),
        role: "option",
        [ARIA.selected]: String(selected),
        [ARIA.disabled]: disabled ? "true" : null,
        hidden: nativeOption.hidden,
        title: nativeOption.title || null,
      },
    },
    documentContext,
  );

  const checkElement = createElement(
    "span",
    {
      className: [CLASS_NAMES.optionCheck, "has-icon", "icon-check"],
      attributes: {
        [ARIA.hidden]: "true",
      },
    },
    documentContext,
  );

  const labelElement = createElement(
    "span",
    {
      className: CLASS_NAMES.optionLabel,
      attributes: {
        dir: "auto",
      },
      text: getOptionLabel(nativeOption),
    },
    documentContext,
  );

  optionElement.append(checkElement, labelElement);

  return {
    nativeOption,
    element: optionElement,
    labelElement,
    checkElement,
  };
}

function createOptionGroup(nativeGroup, idPrefix, startIndex) {
  const documentContext = nativeGroup.ownerDocument;
  const labelId = createUniqueId(`${idPrefix}-group-label`, documentContext);

  const groupElement = createElement(
    "div",
    {
      className: CLASS_NAMES.group,
      attributes: {
        role: "group",
        [ARIA.labelledBy]: labelId,
        [ARIA.disabled]: nativeGroup.disabled ? "true" : null,
        hidden: nativeGroup.hidden,
      },
    },
    documentContext,
  );

  const labelElement = createElement(
    "div",
    {
      className: CLASS_NAMES.groupLabel,
      attributes: {
        id: labelId,
        dir: "auto",
      },
      text: nativeGroup.label,
    },
    documentContext,
  );

  const records = Array.from(nativeGroup.children)
    .filter((element) => element.tagName === "OPTION")
    .map((nativeOption, index) =>
      createOptionRecord(nativeOption, idPrefix, startIndex + index),
    );

  groupElement.append(labelElement, ...records.map((record) => record.element));

  return {
    element: groupElement,
    records,
  };
}

/**
 * Recreates listbox options from the native select while preserving optgroups,
 * disabled states, hidden options, selection, and source-element references.
 */

export function renderCustomSelectOptions({
  native,
  listbox,
  idPrefix = native?.id || "custom-select",
}) {
  if (!native || !listbox) return [];

  const fragment = native.ownerDocument.createDocumentFragment();
  const records = [];

  Array.from(native.children).forEach((child) => {
    if (child.tagName === "OPTGROUP") {
      const group = createOptionGroup(child, idPrefix, records.length);

      fragment.append(group.element);
      records.push(...group.records);
      return;
    }

    if (child.tagName !== "OPTION") return;

    const record = createOptionRecord(child, idPrefix, records.length);

    fragment.append(record.element);
    records.push(record);
  });

  listbox.replaceChildren(fragment);

  return records;
}

/* ==========================================================================
   Search
   ========================================================================== */

function createSearchMarkup({
  documentContext,
  listboxId,
  messages,
  idPrefix,
}) {
  const searchElement = createElement(
    "div",
    {
      className: CLASS_NAMES.search,
    },
    documentContext,
  );

  const fieldElement = createElement(
    "div",
    {
      className: CLASS_NAMES.searchField,
    },
    documentContext,
  );

  const iconElement = createElement(
    "span",
    {
      className: [CLASS_NAMES.searchIcon, "has-icon", "icon-search"],
      attributes: {
        [ARIA.hidden]: "true",
      },
    },
    documentContext,
  );

  const inputElement = createElement(
    "input",
    {
      className: CLASS_NAMES.searchInput,
      attributes: {
        id: createUniqueId(`${idPrefix}-search`, documentContext),
        type: "search",
        role: "searchbox",
        autocomplete: "off",
        autocapitalize: "none",
        spellcheck: "false",
        dir: "auto",
        placeholder: messages.searchPlaceholder,
        [ARIA.label]: messages.searchPlaceholder,
        [ARIA.controls]: listboxId,
        "aria-autocomplete": "list",
      },
    },
    documentContext,
  );

  const clearElement = createElement(
    "button",
    {
      className: [CLASS_NAMES.searchClear, "has-icon", "icon-close-x"],
      attributes: {
        type: "button",
        hidden: true,
        [ARIA.label]: messages.clearSearch,
      },
    },
    documentContext,
  );

  fieldElement.append(iconElement, inputElement, clearElement);
  searchElement.append(fieldElement);

  return {
    element: searchElement,
    fieldElement,
    inputElement,
    clearElement,
  };
}

/* ==========================================================================
   Enhanced Interface
   ========================================================================== */

/**
 * Creates the complete enhanced interface without attaching it to the
 * component. The controller appends it only after successful construction.
 */

export function createCustomSelectMarkup({ component, native, messages }) {
  if (!component || !native || !messages) {
    throw new TypeError(
      "Custom select markup requires component, native, and messages.",
    );
  }

  const documentContext = native.ownerDocument;
  const nativeId = ensureId(native, "custom-select");
  const idPrefix = `${nativeId}-custom-select`;

  const valueId = createUniqueId(`${idPrefix}-value`, documentContext);
  const listboxId = createUniqueId(`${idPrefix}-listbox`, documentContext);
  const popoverId = createUniqueId(`${idPrefix}-popover`, documentContext);
  const statusId = createUniqueId(`${idPrefix}-status`, documentContext);

  const labels = createLabelReferences(native, valueId, idPrefix);

  const interfaceElement = createElement(
    "div",
    {
      className: CLASS_NAMES.interface,
    },
    documentContext,
  );

  const controlElement = createElement(
    "div",
    {
      className: CLASS_NAMES.control,
    },
    documentContext,
  );

  const triggerElement = createElement(
    "button",
    {
      className: CLASS_NAMES.trigger,
      attributes: {
        id: createUniqueId(`${idPrefix}-trigger`, documentContext),
        type: "button",
        role: "combobox",
        disabled: native.disabled,
        [ARIA.expanded]: "false",
        [ARIA.hasPopup]: "listbox",
        [ARIA.controls]: listboxId,
        [ARIA.labelledBy]: labels.triggerLabelledBy || null,
        [ARIA.describedBy]:
          native.getAttribute(ARIA.describedBy)?.trim() || null,
        [ARIA.invalid]: native.getAttribute(ARIA.invalid)?.trim() || null,
        "aria-required": native.required ? "true" : null,
      },
    },
    documentContext,
  );

  const valueElement = createElement(
    "span",
    {
      className: CLASS_NAMES.value,
      attributes: {
        id: valueId,
        dir: "auto",
      },
    },
    documentContext,
  );

  const indicatorElement = createElement(
    "span",
    {
      className: [CLASS_NAMES.indicator, "has-icon", "icon-chevron-down"],
      attributes: {
        [ARIA.hidden]: "true",
      },
    },
    documentContext,
  );

  triggerElement.append(valueElement, indicatorElement);
  controlElement.append(triggerElement);

  let clearElement = null;

  if (component.hasAttribute(DATA_ATTRIBUTES.clearable)) {
    clearElement = createElement(
      "button",
      {
        className: [CLASS_NAMES.clear, "has-icon", "icon-close-x"],
        attributes: {
          type: "button",
          hidden: true,
          disabled: native.disabled,
          [ARIA.label]: messages.clearSelection,
        },
      },
      documentContext,
    );

    controlElement.append(clearElement);
  }

  const popoverElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popover,
      attributes: {
        id: popoverId,
        popover: "manual",
      },
    },
    documentContext,
  );

  const listboxElement = createElement(
    "div",
    {
      className: CLASS_NAMES.listbox,
      attributes: {
        id: listboxId,
        role: "listbox",
        [ARIA.labelledBy]:
          labels.labelReference || labels.triggerLabelledBy || null,
        [ARIA.multiSelectable]: native.multiple ? "true" : null,
      },
    },
    documentContext,
  );

  const emptyElement = createElement(
    "p",
    {
      className: CLASS_NAMES.empty,
      attributes: {
        hidden: true,
      },
      text: messages.noResults,
    },
    documentContext,
  );

  let search = null;

  if (component.hasAttribute(DATA_ATTRIBUTES.searchable)) {
    search = createSearchMarkup({
      documentContext,
      listboxId,
      messages,
      idPrefix,
    });

    popoverElement.append(search.element);
  }

  const optionRecords = renderCustomSelectOptions({
    native,
    listbox: listboxElement,
    idPrefix,
  });

  emptyElement.hidden = optionRecords.length > 0;

  popoverElement.append(listboxElement, emptyElement);

  const statusElement = createElement(
    "span",
    {
      className: "visually-hidden",
      attributes: {
        id: statusId,
        role: "status",
        [ARIA.live]: "polite",
        "aria-atomic": "true",
      },
    },
    documentContext,
  );

  if (labels.generatedLabel) {
    interfaceElement.append(labels.generatedLabel);
  }

  interfaceElement.append(controlElement, popoverElement, statusElement);

  return {
    interfaceElement,
    controlElement,
    triggerElement,
    valueElement,
    indicatorElement,
    clearElement,
    popoverElement,
    searchElement: search?.element || null,
    searchInputElement: search?.inputElement || null,
    searchClearElement: search?.clearElement || null,
    listboxElement,
    emptyElement,
    statusElement,
    optionRecords,

    ids: Object.freeze({
      value: valueId,
      listbox: listboxId,
      popover: popoverId,
      status: statusId,
    }),
  };
}
