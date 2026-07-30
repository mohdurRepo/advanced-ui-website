import { ARIA, CLASS_NAMES, DATA_ATTRIBUTES, MODES, ROLES } from "./constants";

import { createElement, ensureElementId, getAssociatedLabel } from "./utils";

/* ==========================================================================
   Label Resolution
   ========================================================================== */

function getRangeLegend(component) {
  const fieldset = component.closest("fieldset");

  if (!fieldset) {
    return null;
  }

  return (
    Array.from(fieldset.children).find((child) => child.tagName === "LEGEND") ||
    null
  );
}

function getComponentLabel(component, mode, startInput) {
  if (mode === MODES.range) {
    return getRangeLegend(component);
  }

  return getAssociatedLabel(startInput);
}

/* ==========================================================================
   Descriptions
   ========================================================================== */

function getDescriptionIds(...inputs) {
  const ids = inputs.filter(Boolean).flatMap((input) =>
    String(input.getAttribute(ARIA.describedBy) || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );

  return [...new Set(ids)].join(" ");
}

/* ==========================================================================
   Single Value
   ========================================================================== */

function createSingleValue(documentReference, valueId) {
  return createElement(
    "span",
    {
      className: CLASS_NAMES.value,
      attributes: {
        id: valueId,
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Range Value
   ========================================================================== */

function createRangeValue(documentReference, valueId) {
  const valueElement = createElement(
    "span",
    {
      className: `${CLASS_NAMES.value} ${CLASS_NAMES.rangeValue}`,
      attributes: {
        id: valueId,
      },
    },
    documentReference,
  );

  const startValueElement = createElement(
    "span",
    {
      className: CLASS_NAMES.rangeStart,
    },
    documentReference,
  );

  const separatorElement = createElement(
    "span",
    {
      className: CLASS_NAMES.rangeSeparator,
      attributes: {
        [ARIA.hidden]: "true",
      },
      text: "–",
    },
    documentReference,
  );

  const endValueElement = createElement(
    "span",
    {
      className: CLASS_NAMES.rangeEnd,
    },
    documentReference,
  );

  valueElement.append(startValueElement, separatorElement, endValueElement);

  return {
    valueElement,
    startValueElement,
    endValueElement,
    separatorElement,
  };
}

/* ==========================================================================
   Trigger
   ========================================================================== */

function createTrigger({
  component,
  mode,
  startInput,
  endInput,
  messages,
  documentReference,
  triggerId,
  valueId,
  popoverId,
}) {
  const labelElement = getComponentLabel(component, mode, startInput);

  const labelId = labelElement
    ? ensureElementId(labelElement, "custom-date-label")
    : "";

  const describedBy = getDescriptionIds(startInput, endInput);

  const triggerElement = createElement(
    "button",
    {
      className: CLASS_NAMES.trigger,
      attributes: {
        id: triggerId,
        type: "button",
        [ARIA.controls]: popoverId,
        [ARIA.expanded]: "false",
        [ARIA.hasPopup]: "dialog",
        [ARIA.labelledBy]: [labelId, valueId].filter(Boolean).join(" ") || null,
        [ARIA.describedBy]: describedBy || null,
      },
    },
    documentReference,
  );

  if (!labelId) {
    triggerElement.setAttribute(
      ARIA.label,
      mode === MODES.range ? messages.rangeDialog : messages.calendarDialog,
    );
  }

  return {
    triggerElement,
    labelElement,
    labelId,
  };
}

/* ==========================================================================
   Calendar Indicator
   ========================================================================== */

function createIndicator(documentReference) {
  return createElement(
    "span",
    {
      className:
        `${CLASS_NAMES.indicator} ` + "has-icon icon-calendar-scheduler",
      attributes: {
        [ARIA.hidden]: "true",
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Clear Action
   ========================================================================== */

function createClearAction({ mode, messages, documentReference }) {
  return createElement(
    "button",
    {
      className: `${CLASS_NAMES.clear} ` + "has-icon icon-close-x",
      attributes: {
        type: "button",
        [ARIA.label]:
          mode === MODES.range ? messages.clearRange : messages.clearDate,
        hidden: true,
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Control
   ========================================================================== */

function createControl({
  component,
  mode,
  startInput,
  endInput,
  messages,
  documentReference,
  triggerId,
  valueId,
  popoverId,
}) {
  const controlElement = createElement(
    "div",
    {
      className: CLASS_NAMES.control,
    },
    documentReference,
  );

  const trigger = createTrigger({
    component,
    mode,
    startInput,
    endInput,
    messages,
    documentReference,
    triggerId,
    valueId,
    popoverId,
  });

  const valueMarkup =
    mode === MODES.range
      ? createRangeValue(documentReference, valueId)
      : {
          valueElement: createSingleValue(documentReference, valueId),
          startValueElement: null,
          endValueElement: null,
          separatorElement: null,
        };

  const indicatorElement = createIndicator(documentReference);

  trigger.triggerElement.append(valueMarkup.valueElement, indicatorElement);

  controlElement.append(trigger.triggerElement);

  const clearable = component.hasAttribute(DATA_ATTRIBUTES.clearable);

  const clearElement = clearable
    ? createClearAction({
        mode,
        messages,
        documentReference,
      })
    : null;

  if (clearElement) {
    controlElement.append(clearElement);
  }

  return {
    controlElement,
    triggerElement: trigger.triggerElement,
    valueElement: valueMarkup.valueElement,
    startValueElement: valueMarkup.startValueElement,
    endValueElement: valueMarkup.endValueElement,
    separatorElement: valueMarkup.separatorElement,
    indicatorElement,
    clearElement,
    labelElement: trigger.labelElement,
    labelId: trigger.labelId,
  };
}

/* ==========================================================================
   Calendar Region
   ========================================================================== */

function createCalendarRegion(documentReference) {
  return createElement(
    "div",
    {
      className: CLASS_NAMES.calendars,
    },
    documentReference,
  );
}

/* ==========================================================================
   Selection Summary
   ========================================================================== */

/**
 * The summary remains available to assistive technology.
 *
 * `_popover.scss` visually hides this element, so it does not appear in the
 * footer while still providing selection context to screen-reader users.
 */

function createSelectionSummary({ messages, documentReference }) {
  const summaryElement = createElement(
    "div",
    {
      className: CLASS_NAMES.selectionSummary,
    },
    documentReference,
  );

  const labelElement = createElement(
    "span",
    {
      className: CLASS_NAMES.selectionSummaryLabel,
      text: messages.selectedRange,
    },
    documentReference,
  );

  const valueElement = createElement(
    "span",
    {
      className:
        `${CLASS_NAMES.selectionSummaryValue} ` + CLASS_NAMES.placeholder,
      text: messages.noRangeSelected,
    },
    documentReference,
  );

  summaryElement.append(labelElement, valueElement);

  return {
    summaryElement,
    summaryLabelElement: labelElement,
    summaryValueElement: valueElement,
  };
}

/* ==========================================================================
   Presets Region
   ========================================================================== */

function createPresetsRegion({ mode, messages, documentReference }) {
  if (mode !== MODES.range) {
    return {
      presetsElement: null,
      presetsLabelElement: null,
    };
  }

  const presetsElement = createElement(
    "div",
    {
      className: CLASS_NAMES.presets,
      attributes: {
        hidden: true,
      },
    },
    documentReference,
  );

  const presetsLabelElement = createElement(
    "span",
    {
      className: CLASS_NAMES.presetsLabel,
      text: messages.presetsLabel,
    },
    documentReference,
  );

  presetsElement.append(presetsLabelElement);

  return {
    presetsElement,
    presetsLabelElement,
  };
}

/* ==========================================================================
   Footer Action
   ========================================================================== */

function createFooterAction({ className, label, documentReference }) {
  return createElement(
    "button",
    {
      className: `${CLASS_NAMES.action} ${className}`,
      attributes: {
        type: "button",
      },
      text: label,
    },
    documentReference,
  );
}

/* ==========================================================================
   Footer Actions
   ========================================================================== */

function createFooterActions({ mode, messages, documentReference }) {
  const actionsElement = createElement(
    "div",
    {
      className: CLASS_NAMES.actions,
    },
    documentReference,
  );

  const todayElement = createFooterAction({
    className: CLASS_NAMES.actionToday,
    label: messages.today,
    documentReference,
  });

  const clearElement = createFooterAction({
    className: CLASS_NAMES.actionClear,
    label: messages.clear,
    documentReference,
  });

  const cancelElement = createFooterAction({
    className: CLASS_NAMES.actionCancel,
    label: messages.cancel,
    documentReference,
  });

  const applyElement =
    mode === MODES.range
      ? createFooterAction({
          className: CLASS_NAMES.actionApply,
          label: messages.apply,
          documentReference,
        })
      : null;

  actionsElement.append(todayElement, clearElement, cancelElement);

  if (applyElement) {
    actionsElement.append(applyElement);
  }

  return {
    actionsElement,
    todayActionElement: todayElement,
    clearActionElement: clearElement,
    cancelActionElement: cancelElement,
    applyActionElement: applyElement,
  };
}

/* ==========================================================================
   Popover Footer
   ========================================================================== */

function createFooter({ mode, messages, documentReference }) {
  const footerElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverFooter,
    },
    documentReference,
  );

  const summary =
    mode === MODES.range
      ? createSelectionSummary({
          messages,
          documentReference,
        })
      : {
          summaryElement: null,
          summaryLabelElement: null,
          summaryValueElement: null,
        };

  const presets = createPresetsRegion({
    mode,
    messages,
    documentReference,
  });

  const actions = createFooterActions({
    mode,
    messages,
    documentReference,
  });

  if (summary.summaryElement) {
    footerElement.append(summary.summaryElement);
  }

  if (presets.presetsElement) {
    footerElement.append(presets.presetsElement);
  }

  footerElement.append(actions.actionsElement);

  return {
    footerElement,
    ...summary,
    ...presets,
    ...actions,
  };
}

/* ==========================================================================
   Live Status
   ========================================================================== */

/**
 * The status element announces date-selection changes without becoming visible.
 * Its visually-hidden presentation is owned by `_popover.scss`.
 */

function createStatus({ documentReference, statusId }) {
  return createElement(
    "div",
    {
      className: CLASS_NAMES.status,
      attributes: {
        id: statusId,
        role: ROLES.status,
        [ARIA.live]: "polite",
        [ARIA.atomic]: "true",
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Popover
   ========================================================================== */

/**
 * `popover="manual"` keeps lifecycle ownership inside the component.
 *
 * Automatic light-dismiss is intentionally avoided because range selection
 * requires multiple interactions and must remain open until explicitly closed.
 */

function createPopover({
  mode,
  messages,
  documentReference,
  popoverId,
  triggerId,
  statusId,
}) {
  const popoverElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popover,
      attributes: {
        id: popoverId,
        popover: "manual",
        role: ROLES.dialog,
        [ARIA.modal]: "false",
        [ARIA.labelledBy]: triggerId,
        tabindex: "-1",
      },
    },
    documentReference,
  );

  const shellElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverShell,
    },
    documentReference,
  );

  const mainElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverMain,
    },
    documentReference,
  );

  const calendarsElement = createCalendarRegion(documentReference);

  mainElement.append(calendarsElement);

  const footer = createFooter({
    mode,
    messages,
    documentReference,
  });

  const statusElement = createStatus({
    documentReference,
    statusId,
  });

  shellElement.append(mainElement, footer.footerElement, statusElement);

  popoverElement.append(shellElement);

  return {
    popoverElement,
    shellElement,
    mainElement,
    calendarsElement,
    statusElement,
    ...footer,
  };
}

/* ==========================================================================
   Complete Interface
   ========================================================================== */

export function createCustomDateMarkup({
  component,
  mode,
  startInput,
  endInput = null,
  messages,
}) {
  const documentReference = component.ownerDocument;

  const nativeId = ensureElementId(startInput, "custom-date-native");

  if (endInput) {
    ensureElementId(endInput, "custom-date-native-end");
  }

  const idPrefix = `${nativeId}-custom-date`;

  const triggerId = `${idPrefix}-trigger`;
  const valueId = `${idPrefix}-value`;
  const popoverId = `${idPrefix}-popover`;
  const statusId = `${idPrefix}-status`;

  const interfaceElement = createElement(
    "div",
    {
      className: CLASS_NAMES.interface,
    },
    documentReference,
  );

  const control = createControl({
    component,
    mode,
    startInput,
    endInput,
    messages,
    documentReference,
    triggerId,
    valueId,
    popoverId,
  });

  const popover = createPopover({
    mode,
    messages,
    documentReference,
    popoverId,
    triggerId,
    statusId,
  });

  interfaceElement.append(control.controlElement, popover.popoverElement);

  return {
    interfaceElement,

    ...control,
    ...popover,

    triggerId,
    valueId,
    popoverId,
    statusId,
  };
}
