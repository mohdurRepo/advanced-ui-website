import {
  ARIA,
  BOUNDARIES,
  CLASS_NAMES,
  COMPONENT_EVENTS,
  DATA_ATTRIBUTES,
  DEFAULTS,
  DOM_EVENTS,
  KEYS,
  MODES,
  SELECTORS,
  SIDES,
  VIEWS,
} from "./constants";
import { CALENDAR_ACTIONS, renderCustomDateCalendars } from "./calendar";
import { createCustomDateMarkup } from "./markup";
import { getCustomDateMessages } from "./messages";
import { CustomDatePositioner } from "./position";
import {
  getPresetRange,
  renderCustomDatePresets,
  syncCustomDatePresetState,
} from "./presets";
import {
  addDays,
  addMonths,
  addYears,
  cloneDate,
  createDate,
  dispatchComponentEvent,
  endOfWeek,
  ensureElementId,
  focusSafely,
  formatAccessibleDate,
  formatISODate,
  getAssociatedLabel,
  getFirstDayOfWeek,
  getToday,
  isAfter,
  isBefore,
  isInputElement,
  isSameDay,
  parseBooleanAttribute,
  parseCommaSeparatedList,
  parseDisabledWeekdays,
  parseISODate,
  readCssTime,
  restoreAttribute,
  startOfMonth,
  startOfWeek,
} from "./utils";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();
let activeInstance = null;

/* ==========================================================================
   Element Resolution
   ========================================================================== */

function getMode(component) {
  return component.matches(SELECTORS.rangeComponent)
    ? MODES.range
    : MODES.single;
}

function getNativeInputs(component, mode) {
  if (mode === MODES.range) {
    const startInput = component.querySelector(SELECTORS.startInput);

    const endInput = component.querySelector(SELECTORS.endInput);

    return {
      startInput: isInputElement(startInput) ? startInput : null,

      endInput: isInputElement(endInput) ? endInput : null,
    };
  }

  const input = component.querySelector(SELECTORS.native);

  return {
    startInput: isInputElement(input) ? input : null,

    endInput: null,
  };
}

/* ==========================================================================
   Native Value Signature
   ========================================================================== */

function getValueSignature(startInput, endInput) {
  return JSON.stringify({
    start: startInput?.value || "",
    end: endInput?.value || "",
  });
}

/* ==========================================================================
   Date Limits
   ========================================================================== */

function getLaterDate(firstDate, secondDate) {
  if (!firstDate) {
    return cloneDate(secondDate);
  }

  if (!secondDate) {
    return cloneDate(firstDate);
  }

  return isAfter(firstDate, secondDate)
    ? cloneDate(firstDate)
    : cloneDate(secondDate);
}

function getEarlierDate(firstDate, secondDate) {
  if (!firstDate) {
    return cloneDate(secondDate);
  }

  if (!secondDate) {
    return cloneDate(firstDate);
  }

  return isBefore(firstDate, secondDate)
    ? cloneDate(firstDate)
    : cloneDate(secondDate);
}

/* ==========================================================================
   Custom Date
   ========================================================================== */

/**
 * Progressively enhances one native date input or native date-input pair.
 *
 * Native inputs remain responsible for submission, constraint validation,
 * reset, autofill, and external integrations.
 */

export class CustomDate {
  static getInstance(component) {
    return instances.get(component) || null;
  }

  static getOrCreateInstance(component, options = {}) {
    const existingInstance = CustomDate.getInstance(component);

    if (existingInstance) {
      return existingInstance;
    }

    try {
      return new CustomDate(component, options);
    } catch (error) {
      component?.classList?.add(CLASS_NAMES.enhancementFailed);

      console.error("Unable to initialize custom date.", error);

      return null;
    }
  }

  static closeActive() {
    if (!activeInstance) return false;

    return activeInstance.close();
  }

  constructor(component, options = {}) {
    if (!component?.matches?.(SELECTORS.component)) {
      throw new TypeError(
        `CustomDate requires an element matching "${SELECTORS.component}".`,
      );
    }

    if (instances.has(component)) {
      throw new Error("This custom date has already been initialized.");
    }

    this.component = component;
    this.document = component.ownerDocument;
    this.view = this.document.defaultView;
    this.mode = getMode(component);

    const nativeInputs = getNativeInputs(component, this.mode);

    if (!nativeInputs.startInput) {
      throw new TypeError("CustomDate requires a native date input.");
    }

    if (this.mode === MODES.range && !nativeInputs.endInput) {
      throw new TypeError("A custom date range requires start and end inputs.");
    }

    this.startInput = nativeInputs.startInput;

    this.endInput = nativeInputs.endInput;

    this.form = this.startInput.form;

    this.options = Object.freeze({
      closeDuration: Number.isFinite(options.closeDuration)
        ? Math.max(0, options.closeDuration)
        : null,

      firstDayOfWeek: Number.isInteger(options.firstDayOfWeek)
        ? options.firstDayOfWeek
        : null,
    });

    this.messages = getCustomDateMessages(component);

    this.config = this.readConfiguration();

    const committedStart = parseISODate(this.startInput.value);

    const committedEnd = parseISODate(this.endInput?.value);

    const initialViewDate = committedStart || committedEnd || getToday();

    this.state = {
      open: false,
      closing: false,
      destroyed: false,
      dispatchingNativeEvents: false,
      refreshQueued: false,

      committedStart,
      committedEnd,

      draftStart: cloneDate(committedStart),

      draftEnd: cloneDate(committedEnd),

      openSnapshotStart: cloneDate(committedStart),

      openSnapshotEnd: cloneDate(committedEnd),

      activeBoundary: BOUNDARIES.start,

      activeDate: cloneDate(committedStart) || cloneDate(initialViewDate),

      previewDate: null,

      primaryViewDate: startOfMonth(initialViewDate),

      panelView: VIEWS.days,
      pickerSide: SIDES.primary,
    };

    this.closeTimer = null;
    this.announcementTimer = null;
    this.resetTimer = null;

    this.abortController = new this.view.AbortController();

    const associatedLabel =
      this.mode === MODES.single ? getAssociatedLabel(this.startInput) : null;

    const rangeLegend =
      this.mode === MODES.range
        ? this.component
            .closest("fieldset")
            ?.querySelector(":scope > legend") || null
        : null;

    this.original = Object.freeze({
      componentRangeClass: component.classList.contains(CLASS_NAMES.range),

      startId: this.startInput.getAttribute("id"),

      startTabIndex: this.startInput.getAttribute("tabindex"),

      endId: this.endInput?.getAttribute("id") ?? null,

      endTabIndex: this.endInput?.getAttribute("tabindex") ?? null,

      labelElement: associatedLabel,

      labelId: associatedLabel?.getAttribute("id") ?? null,

      legendElement: rangeLegend,

      legendId: rangeLegend?.getAttribute("id") ?? null,
    });

    ensureElementId(this.startInput, "custom-date-native");

    if (this.endInput) {
      ensureElementId(this.endInput, "custom-date-native-end");
    }

    const markup = createCustomDateMarkup({
      component,
      mode: this.mode,
      startInput: this.startInput,
      endInput: this.endInput,
      messages: this.messages,
    });

    Object.assign(this, markup);

    this.positioner = new CustomDatePositioner({
      component,
      anchor: this.controlElement,
      popover: this.popoverElement,
      mode: this.mode,
    });

    this.calendarRecords = {
      panels: [],
      dayRecords: [],
      pickerRecords: [],
    };

    this.presetRecords = [];

    this.component.classList.toggle(
      CLASS_NAMES.range,
      this.mode === MODES.range,
    );

    this.component.classList.remove(CLASS_NAMES.enhancementFailed);

    this.startInput.setAttribute("tabindex", "-1");

    if (this.endInput) {
      this.endInput.setAttribute("tabindex", "-1");
    }

    this.component.append(this.interfaceElement);

    this.component.classList.add(CLASS_NAMES.enhanced);

    this.bindEvents();
    this.observeChanges();

    this.sync({
      preserveView: false,
    });

    instances.set(component, this);
  }

  /* ==========================================================================
     Public State
     ========================================================================== */

  get isOpen() {
    return this.state.open;
  }

  get isRange() {
    return this.mode === MODES.range;
  }

  get isDisabled() {
    return Boolean(
      this.startInput.disabled ||
      this.endInput?.disabled ||
      this.component.hasAttribute("disabled") ||
      this.component.classList.contains(CLASS_NAMES.disabled) ||
      this.component.getAttribute(ARIA.disabled) === "true",
    );
  }

  get isReadonly() {
    return Boolean(
      this.startInput.readOnly ||
      this.endInput?.readOnly ||
      this.component.classList.contains(CLASS_NAMES.readonly),
    );
  }

  get isLoading() {
    return Boolean(
      this.component.classList.contains(CLASS_NAMES.loading) ||
      this.component.getAttribute(ARIA.busy) === "true",
    );
  }

  get value() {
    if (!this.isRange) {
      return this.startInput.value;
    }

    return {
      start: this.startInput.value,
      end: this.endInput.value,
    };
  }

  /* ==========================================================================
     Configuration
     ========================================================================== */

  readConfiguration() {
    const startMinimum = parseISODate(this.startInput.min);

    const endMinimum = parseISODate(this.endInput?.min);

    const startMaximum = parseISODate(this.startInput.max);

    const endMaximum = parseISODate(this.endInput?.max);

    const locale = this.messages.locale;

    return {
      locale,

      firstDayOfWeek:
        this.options.firstDayOfWeek ??
        getFirstDayOfWeek(locale, DEFAULTS.firstDayOfWeek),

      minimumDate: getLaterDate(startMinimum, endMinimum),

      maximumDate: getEarlierDate(startMaximum, endMaximum),

      disablePast: parseBooleanAttribute(
        this.component.getAttribute(DATA_ATTRIBUTES.disablePast),
      ),

      disableFuture: parseBooleanAttribute(
        this.component.getAttribute(DATA_ATTRIBUTES.disableFuture),
      ),

      disabledWeekdays: parseDisabledWeekdays(
        this.component.getAttribute(DATA_ATTRIBUTES.disabledWeekdays),
      ),

      presets: parseCommaSeparatedList(
        this.component.getAttribute(DATA_ATTRIBUTES.presets),
      ),

      clearable: this.component.hasAttribute(DATA_ATTRIBUTES.clearable),

      placeholder:
        this.component.getAttribute(DATA_ATTRIBUTES.placeholder)?.trim() ||
        (this.isRange ? DEFAULTS.rangePlaceholder : DEFAULTS.singlePlaceholder),
    };
  }

  /* ==========================================================================
     Event Registration
     ========================================================================== */

  listen(target, type, listener, options = {}) {
    if (!target?.addEventListener) {
      return;
    }

    target.addEventListener(type, listener, {
      ...options,
      signal: this.abortController.signal,
    });
  }

  /* ==========================================================================
     Event Binding
     ========================================================================== */

  bindEvents() {
    this.listen(this.triggerElement, DOM_EVENTS.click, () => {
      this.toggle();
    });

    this.listen(this.triggerElement, DOM_EVENTS.keydown, (event) => {
      this.handleTriggerKeydown(event);
    });

    if (this.clearElement) {
      this.listen(this.clearElement, DOM_EVENTS.pointerdown, (event) => {
        event.preventDefault();
      });

      this.listen(this.clearElement, DOM_EVENTS.click, (event) => {
        event.preventDefault();
        event.stopPropagation();

        this.clear({
          source: "control-clear",
          keepOpen: this.state.open,
        });

        focusSafely(this.triggerElement);
      });
    }

    this.listen(this.popoverElement, DOM_EVENTS.click, (event) => {
      this.handlePopoverClick(event);
    });

    this.listen(this.popoverElement, DOM_EVENTS.keydown, (event) => {
      this.handlePopoverKeydown(event);
    });

    this.listen(this.calendarsElement, DOM_EVENTS.pointermove, (event) => {
      this.handleCalendarPointerMove(event);
    });

    this.listen(this.calendarsElement, DOM_EVENTS.pointerleave, () => {
      this.clearRangePreview();
    });

    this.listen(this.startInput, DOM_EVENTS.change, () => {
      this.handleNativeChange();
    });

    if (this.endInput) {
      this.listen(this.endInput, DOM_EVENTS.change, () => {
        this.handleNativeChange();
      });
    }

    this.listen(this.startInput, DOM_EVENTS.focus, () => {
      this.redirectNativeFocus(BOUNDARIES.start);
    });

    if (this.endInput) {
      this.listen(this.endInput, DOM_EVENTS.focus, () => {
        this.redirectNativeFocus(BOUNDARIES.end);
      });
    }

    this.listen(this.startInput, "invalid", () => {
      this.handleNativeInvalid(BOUNDARIES.start);
    });

    if (this.endInput) {
      this.listen(this.endInput, "invalid", () => {
        this.handleNativeInvalid(BOUNDARIES.end);
      });
    }

    if (this.form) {
      this.listen(this.form, DOM_EVENTS.reset, () => {
        this.close({
          immediate: true,
          emit: false,
          resolveDraft: false,
        });

        this.clearResetTimer();

        this.resetTimer = this.view.setTimeout(() => {
          this.resetTimer = null;

          if (!this.state.destroyed) {
            this.refresh();
          }
        }, 0);
      });
    }

    this.listen(this.document, DOM_EVENTS.pointerdown, (event) => {
      if (!this.state.open || this.component.contains(event.target)) {
        return;
      }

      this.close({
        source: "outside",
      });
    });

    const closeOnOutsideScrollIntent = (event) => {
      if (!this.state.open) return;

      const target = event.target;

      const insidePopover =
        target instanceof this.view.Node &&
        this.popoverElement.contains(target);

      if (!insidePopover) {
        this.close({
          source: "outside-scroll",
        });
      }
    };

    this.listen(this.document, DOM_EVENTS.wheel, closeOnOutsideScrollIntent, {
      capture: true,
      passive: true,
    });

    this.listen(
      this.document,
      DOM_EVENTS.touchmove,
      closeOnOutsideScrollIntent,
      {
        capture: true,
        passive: true,
      },
    );

    this.listen(this.view, "languagechange", () => {
      this.refreshMessages();
      this.refresh();
    });
  }

  /* ==========================================================================
     Mutation Observation
     ========================================================================== */

  observeChanges() {
    if (typeof this.view.MutationObserver !== "function") {
      return;
    }

    this.mutationObserver = new this.view.MutationObserver((mutations) => {
      if (this.state.destroyed) {
        return;
      }

      const onlyControlStateChanged = mutations.every(
        (mutation) =>
          mutation.type === "attributes" &&
          [
            "aria-describedby",
            "aria-invalid",
            "disabled",
            "readonly",
            "required",
          ].includes(mutation.attributeName),
      );

      if (onlyControlStateChanged) {
        this.syncControlState();
        return;
      }

      this.scheduleRefresh();
    });

    const nativeAttributeFilter = [
      "aria-describedby",
      "aria-invalid",
      "disabled",
      "max",
      "min",
      "readonly",
      "required",
      "value",
    ];

    this.mutationObserver.observe(this.startInput, {
      attributes: true,
      attributeFilter: nativeAttributeFilter,
    });

    if (this.endInput) {
      this.mutationObserver.observe(this.endInput, {
        attributes: true,
        attributeFilter: nativeAttributeFilter,
      });
    }

    this.mutationObserver.observe(this.component, {
      attributes: true,
      attributeFilter: [
        ARIA.busy,
        ARIA.disabled,
        "disabled",
        DATA_ATTRIBUTES.placeholder,
        DATA_ATTRIBUTES.disablePast,
        DATA_ATTRIBUTES.disableFuture,
        DATA_ATTRIBUTES.disabledWeekdays,
        DATA_ATTRIBUTES.presets,
      ],
    });
  }

  scheduleRefresh() {
    if (this.state.refreshQueued) {
      return;
    }

    this.state.refreshQueued = true;

    queueMicrotask(() => {
      this.state.refreshQueued = false;

      if (!this.state.destroyed) {
        this.refresh();
      }
    });
  }

  /* ==========================================================================
     Open Snapshot
     ========================================================================== */

  captureOpenSnapshot() {
    this.state.openSnapshotStart = cloneDate(this.state.committedStart);

    this.state.openSnapshotEnd = cloneDate(this.state.committedEnd);
  }

  restoreOpenSnapshot({ emit = true, source = "cancel" } = {}) {
    return this.commitValues(
      this.state.openSnapshotStart,
      this.state.openSnapshotEnd,
      {
        emit,
        source,
        syncDraft: true,
      },
    );
  }

  resolveDraftBeforeClose({ source = "dismiss" } = {}) {
    if (!this.isRange) return;

    if (
      this.state.draftStart &&
      this.state.draftEnd &&
      this.isRangeSelectable(this.state.draftStart, this.state.draftEnd)
    ) {
      this.commitValues(this.state.draftStart, this.state.draftEnd, {
        source,
        syncDraft: true,
      });

      return;
    }

    this.state.draftStart = cloneDate(this.state.committedStart);

    this.state.draftEnd = cloneDate(this.state.committedEnd);
  }

  /* ==========================================================================
     Open and Close
     ========================================================================== */

  toggle(force) {
    const shouldOpen = typeof force === "boolean" ? force : !this.state.open;

    return shouldOpen
      ? this.open()
      : this.close({
          returnFocus: true,
        });
  }

  open({ boundary = null, focusCalendar = true } = {}) {
    if (
      this.state.destroyed ||
      this.isDisabled ||
      this.isReadonly ||
      this.isLoading
    ) {
      return false;
    }

    if (this.state.open) {
      if (this.isRange && boundary && boundary !== this.state.activeBoundary) {
        this.setActiveBoundary(boundary);
      }

      if (focusCalendar) {
        this.focusActiveDate();
      }

      return true;
    }

    const beforeOpenEvent = dispatchComponentEvent(
      this.component,
      COMPONENT_EVENTS.beforeOpen,
      {
        instance: this,
        mode: this.mode,
        startInput: this.startInput,
        endInput: this.endInput,
      },
      {
        cancelable: true,
      },
    );

    if (beforeOpenEvent?.defaultPrevented) {
      return false;
    }

    if (activeInstance && activeInstance !== this) {
      activeInstance.close({
        immediate: true,
      });
    }

    activeInstance = this;

    this.clearCloseTimer();
    this.refreshMessages();
    this.captureOpenSnapshot();

    this.state.draftStart = cloneDate(this.state.committedStart);

    this.state.draftEnd = cloneDate(this.state.committedEnd);

    this.state.previewDate = null;
    this.state.panelView = VIEWS.days;
    this.state.pickerSide = SIDES.primary;

    this.state.activeBoundary =
      boundary ||
      (this.isRange && this.state.draftStart && !this.state.draftEnd
        ? BOUNDARIES.end
        : BOUNDARIES.start);

    const preferredDate =
      this.state.activeBoundary === BOUNDARIES.end
        ? this.state.draftEnd || this.state.draftStart
        : this.state.draftStart;

    this.state.activeDate = cloneDate(preferredDate) || getToday();

    this.state.primaryViewDate = startOfMonth(this.state.activeDate);

    this.state.open = true;
    this.state.closing = false;

    this.component.classList.add(CLASS_NAMES.open);

    this.component.setAttribute(
      DATA_ATTRIBUTES.activeBoundary,
      this.state.activeBoundary,
    );

    this.popoverElement.classList.remove(CLASS_NAMES.closing);

    this.popoverElement.classList.add(CLASS_NAMES.open);

    this.triggerElement.setAttribute(ARIA.expanded, "true");

    this.render();

    this.showNativePopover();
    this.positioner.start();

    if (focusCalendar) {
      this.focusActiveDate();
    }

    dispatchComponentEvent(this.component, COMPONENT_EVENTS.open, {
      instance: this,
      mode: this.mode,
    });

    return true;
  }

  close({
    immediate = false,
    returnFocus = false,
    emit = true,
    resolveDraft = true,
    source = "dismiss",
  } = {}) {
    if (this.state.destroyed && !immediate) {
      return false;
    }

    if (!this.state.open && !this.state.closing) {
      return false;
    }

    const wasOpen = this.state.open;

    if (wasOpen && resolveDraft) {
      this.resolveDraftBeforeClose({
        source,
      });
    }

    this.state.open = false;
    this.state.closing = !immediate;
    this.state.previewDate = null;

    if (activeInstance === this) {
      activeInstance = null;
    }

    this.component.classList.remove(CLASS_NAMES.open, CLASS_NAMES.openUp);

    this.component.removeAttribute(DATA_ATTRIBUTES.activeBoundary);

    this.popoverElement.classList.remove(CLASS_NAMES.open);

    this.triggerElement.setAttribute(ARIA.expanded, "false");

    this.positioner.stop();
    this.hideNativePopover();

    this.renderValue();

    if (returnFocus && !this.state.destroyed) {
      focusSafely(this.triggerElement);
    }

    if (emit && wasOpen) {
      dispatchComponentEvent(this.component, COMPONENT_EVENTS.close, {
        instance: this,
        mode: this.mode,
        source,
      });
    }

    this.clearCloseTimer();

    if (immediate) {
      this.finishClose();
      return true;
    }

    this.popoverElement.classList.add(CLASS_NAMES.closing);

    const duration =
      this.options.closeDuration ??
      readCssTime(
        this.popoverElement,
        "--custom-date-popover-duration",
        DEFAULTS.closeDuration,
      );

    if (duration === 0) {
      this.finishClose();
      return true;
    }

    this.closeTimer = this.view.setTimeout(() => {
      this.closeTimer = null;
      this.finishClose();
    }, duration);

    return true;
  }

  cancel({ returnFocus = true } = {}) {
    this.restoreOpenSnapshot({
      source: "cancel",
    });

    return this.close({
      returnFocus,
      resolveDraft: false,
      source: "cancel",
    });
  }

  finishClose() {
    this.state.closing = false;

    this.popoverElement.classList.remove(CLASS_NAMES.closing);

    this.positioner.stop({
      reset: true,
    });

    this.state.panelView = VIEWS.days;

    this.state.previewDate = null;

    this.state.draftStart = cloneDate(this.state.committedStart);

    this.state.draftEnd = cloneDate(this.state.committedEnd);

    this.renderValue();
  }

  showNativePopover() {
    if (typeof this.popoverElement.showPopover !== "function") {
      return;
    }

    try {
      this.popoverElement.showPopover();
    } catch {
      // The class-based fallback remains functional.
    }
  }

  hideNativePopover() {
    if (typeof this.popoverElement.hidePopover !== "function") {
      return;
    }

    try {
      this.popoverElement.hidePopover();
    } catch {
      // The class-based fallback remains functional.
    }
  }
  /* ==========================================================================
     Trigger Keyboard Interaction
     ========================================================================== */

  handleTriggerKeydown(event) {
    if (this.isDisabled || this.isReadonly || this.isLoading) {
      return;
    }

    switch (event.key) {
      case KEYS.arrowDown:
      case KEYS.arrowUp:
        event.preventDefault();

        this.open({
          focusCalendar: true,
        });
        return;

      case KEYS.enter:
      case KEYS.space:
        event.preventDefault();
        this.toggle();
        return;

      case KEYS.escape:
        if (!this.state.open) return;

        event.preventDefault();

        this.cancel({
          returnFocus: true,
        });
        return;

      default:
    }
  }

  /* ==========================================================================
     Popover Click Handling
     ========================================================================== */

  handlePopoverClick(event) {
    const navigationElement = event.target.closest("[data-date-navigation]");

    if (navigationElement && this.popoverElement.contains(navigationElement)) {
      event.preventDefault();

      this.handleNavigation(
        navigationElement.getAttribute("data-date-navigation"),
        navigationElement.getAttribute(DATA_ATTRIBUTES.side) || SIDES.primary,
      );

      return;
    }

    const dayElement = event.target.closest(SELECTORS.day);

    if (dayElement && this.calendarsElement.contains(dayElement)) {
      event.preventDefault();

      const date = parseISODate(dayElement.getAttribute(DATA_ATTRIBUTES.date));

      if (date && !this.isDateDisabled(date)) {
        this.selectDate(date, {
          source: "pointer",
        });
      }

      return;
    }

    const monthElement = event.target.closest(`[${DATA_ATTRIBUTES.month}]`);

    if (monthElement && this.calendarsElement.contains(monthElement)) {
      event.preventDefault();

      this.selectMonth(
        Number.parseInt(monthElement.getAttribute(DATA_ATTRIBUTES.month), 10),
        monthElement.getAttribute(DATA_ATTRIBUTES.side) || SIDES.primary,
      );

      return;
    }

    const yearElement = event.target.closest(`[${DATA_ATTRIBUTES.year}]`);

    if (yearElement && this.calendarsElement.contains(yearElement)) {
      event.preventDefault();

      this.selectYear(
        Number.parseInt(yearElement.getAttribute(DATA_ATTRIBUTES.year), 10),
        yearElement.getAttribute(DATA_ATTRIBUTES.side) || SIDES.primary,
      );

      return;
    }

    const presetElement = event.target.closest(SELECTORS.preset);

    if (presetElement && this.popoverElement.contains(presetElement)) {
      event.preventDefault();

      if (
        presetElement.disabled ||
        presetElement.getAttribute(ARIA.disabled) === "true"
      ) {
        return;
      }

      this.applyPreset(presetElement.getAttribute(DATA_ATTRIBUTES.preset));

      return;
    }

    const actionElement = event.target.closest(SELECTORS.action);

    if (!actionElement || !this.popoverElement.contains(actionElement)) {
      return;
    }

    event.preventDefault();

    if (actionElement.matches(SELECTORS.actionToday)) {
      this.selectToday();
      return;
    }

    if (actionElement.matches(SELECTORS.actionClear)) {
      this.clear({
        source: "popover-clear",
        keepOpen: true,
      });

      return;
    }

    if (actionElement.matches(SELECTORS.actionCancel)) {
      this.cancel({
        returnFocus: true,
      });

      return;
    }

    if (actionElement.matches(SELECTORS.actionApply)) {
      this.applyRange();
    }
  }

  /* ==========================================================================
     Popover Keyboard Interaction
     ========================================================================== */

  handlePopoverKeydown(event) {
    if (event.key === KEYS.escape) {
      event.preventDefault();

      this.cancel({
        returnFocus: true,
      });

      return;
    }

    const dayElement = event.target.closest(SELECTORS.day);

    if (dayElement && this.calendarsElement.contains(dayElement)) {
      this.handleDayKeydown(event, dayElement);

      return;
    }

    const pickerElement = event.target.closest(SELECTORS.pickerOption);

    if (pickerElement && this.calendarsElement.contains(pickerElement)) {
      this.handlePickerKeydown(event, pickerElement);
    }
  }

  /* ==========================================================================
     Day Keyboard Navigation
     ========================================================================== */

  handleDayKeydown(event, dayElement) {
    const currentDate = parseISODate(
      dayElement.getAttribute(DATA_ATTRIBUTES.date),
    );

    if (!currentDate) return;

    const horizontalAmount = this.messages.direction === "rtl" ? -1 : 1;

    let nextDate = null;

    switch (event.key) {
      case KEYS.arrowLeft:
        nextDate = addDays(currentDate, -horizontalAmount);
        break;

      case KEYS.arrowRight:
        nextDate = addDays(currentDate, horizontalAmount);
        break;

      case KEYS.arrowUp:
        nextDate = addDays(currentDate, -7);
        break;

      case KEYS.arrowDown:
        nextDate = addDays(currentDate, 7);
        break;

      case KEYS.home:
        nextDate = startOfWeek(currentDate, this.config.firstDayOfWeek);
        break;

      case KEYS.end:
        nextDate = endOfWeek(currentDate, this.config.firstDayOfWeek);
        break;

      case KEYS.pageUp:
        nextDate = event.shiftKey
          ? addYears(currentDate, -1)
          : addMonths(currentDate, -1);
        break;

      case KEYS.pageDown:
        nextDate = event.shiftKey
          ? addYears(currentDate, 1)
          : addMonths(currentDate, 1);
        break;

      case KEYS.enter:
      case KEYS.space:
        event.preventDefault();

        if (!this.isDateDisabled(currentDate)) {
          this.selectDate(currentDate, {
            source: "keyboard",
          });
        }

        return;

      default:
        return;
    }

    event.preventDefault();

    if (!nextDate) return;

    this.moveActiveDate(nextDate);
  }

  /* ==========================================================================
     Picker Keyboard Navigation
     ========================================================================== */

  handlePickerKeydown(event, optionElement) {
    const records = this.calendarRecords.pickerRecords;

    const currentIndex = records.findIndex(
      (record) => record.element === optionElement,
    );

    if (currentIndex < 0) return;

    const isMonthPicker = this.state.panelView === VIEWS.months;

    const columnCount = isMonthPicker ? 3 : 4;

    let nextIndex = currentIndex;

    switch (event.key) {
      case KEYS.arrowLeft:
        nextIndex += this.messages.direction === "rtl" ? 1 : -1;
        break;

      case KEYS.arrowRight:
        nextIndex += this.messages.direction === "rtl" ? -1 : 1;
        break;

      case KEYS.arrowUp:
        nextIndex -= columnCount;
        break;

      case KEYS.arrowDown:
        nextIndex += columnCount;
        break;

      case KEYS.home:
        nextIndex = 0;
        break;

      case KEYS.end:
        nextIndex = records.length - 1;
        break;

      case KEYS.enter:
      case KEYS.space:
        event.preventDefault();
        optionElement.click();
        return;

      default:
        return;
    }

    event.preventDefault();

    nextIndex = Math.max(0, Math.min(records.length - 1, nextIndex));

    const nextRecord = records[nextIndex];

    records.forEach((record) => {
      record.element.tabIndex = record === nextRecord ? 0 : -1;
    });

    focusSafely(nextRecord.element);
  }

  /* ==========================================================================
     Calendar Navigation
     ========================================================================== */

  handleNavigation(action, side) {
    switch (action) {
      case CALENDAR_ACTIONS.previousMonth:
        this.moveView(-1);
        return;

      case CALENDAR_ACTIONS.nextMonth:
        this.moveView(1);
        return;

      case CALENDAR_ACTIONS.previousYear:
        this.moveView(-12);
        return;

      case CALENDAR_ACTIONS.nextYear:
        this.moveView(12);
        return;

      case CALENDAR_ACTIONS.showMonths:
        this.state.panelView = VIEWS.months;

        this.state.pickerSide = side;

        this.render({
          focusPicker: true,
        });
        return;

      case CALENDAR_ACTIONS.showYears:
        this.state.panelView = VIEWS.years;

        this.state.pickerSide = side;

        this.render({
          focusPicker: true,
        });
        return;

      default:
    }
  }

  moveView(monthAmount) {
    const nextView = addMonths(this.state.primaryViewDate, monthAmount);

    if (!nextView) return;

    this.state.primaryViewDate = startOfMonth(nextView);

    this.state.panelView = VIEWS.days;

    this.state.pickerSide = SIDES.primary;

    this.render();

    dispatchComponentEvent(this.component, COMPONENT_EVENTS.viewChange, {
      instance: this,
      viewDate: cloneDate(this.state.primaryViewDate),
    });
  }

  selectMonth(month, side) {
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      return;
    }

    const sideDate =
      side === SIDES.secondary
        ? addMonths(this.state.primaryViewDate, 1)
        : this.state.primaryViewDate;

    const selectedMonth = createDate(sideDate.getFullYear(), month, 1);

    this.state.primaryViewDate =
      side === SIDES.secondary
        ? startOfMonth(addMonths(selectedMonth, -1))
        : startOfMonth(selectedMonth);

    this.state.panelView = VIEWS.days;

    this.state.pickerSide = SIDES.primary;

    this.state.activeDate = cloneDate(this.state.primaryViewDate);

    this.render({
      focusCalendar: true,
    });
  }

  selectYear(year, side) {
    if (!Number.isInteger(year)) {
      return;
    }

    const sideDate =
      side === SIDES.secondary
        ? addMonths(this.state.primaryViewDate, 1)
        : this.state.primaryViewDate;

    const selectedYear = createDate(year, sideDate.getMonth(), 1);

    this.state.primaryViewDate =
      side === SIDES.secondary
        ? startOfMonth(addMonths(selectedYear, -1))
        : startOfMonth(selectedYear);

    this.state.panelView = VIEWS.days;

    this.state.pickerSide = SIDES.primary;

    this.state.activeDate = cloneDate(this.state.primaryViewDate);

    this.render({
      focusCalendar: true,
    });
  }

  /* ==========================================================================
     Active Date
     ========================================================================== */

  moveActiveDate(date) {
    if (!date) return;

    this.state.activeDate = cloneDate(date);

    const primaryMonth = startOfMonth(this.state.primaryViewDate);

    const secondaryMonth = startOfMonth(
      addMonths(this.state.primaryViewDate, 1),
    );

    const targetMonth = startOfMonth(date);

    if (
      !isSameDay(targetMonth, primaryMonth) &&
      !isSameDay(targetMonth, secondaryMonth)
    ) {
      this.state.primaryViewDate = targetMonth;
    }

    this.render({
      focusCalendar: true,
    });
  }

  focusActiveDate() {
    const matchingRecord = this.calendarRecords.dayRecords.find((record) =>
      isSameDay(record.date, this.state.activeDate),
    );

    const fallbackRecord = this.calendarRecords.dayRecords.find(
      (record) => !record.disabled,
    );

    const record =
      matchingRecord && !matchingRecord.disabled
        ? matchingRecord
        : fallbackRecord;

    if (!record) {
      focusSafely(this.popoverElement);

      return false;
    }

    this.calendarRecords.dayRecords.forEach((dayRecord) => {
      dayRecord.element.tabIndex = dayRecord === record ? 0 : -1;
    });

    this.state.activeDate = cloneDate(record.date);

    return focusSafely(record.element);
  }

  focusActivePickerOption() {
    const selectedRecord = this.calendarRecords.pickerRecords.find(
      (record) => record.element.getAttribute(ARIA.selected) === "true",
    );

    const record = selectedRecord || this.calendarRecords.pickerRecords[0];

    if (!record) return false;

    return focusSafely(record.element);
  }

  /* ==========================================================================
     Pointer Range Preview
     ========================================================================== */

  handleCalendarPointerMove(event) {
    if (
      !this.isRange ||
      this.state.activeBoundary !== BOUNDARIES.end ||
      !this.state.draftStart ||
      this.state.draftEnd
    ) {
      return;
    }

    const dayElement = event.target.closest(SELECTORS.day);

    if (
      !dayElement ||
      dayElement.disabled ||
      dayElement.getAttribute(ARIA.disabled) === "true"
    ) {
      return;
    }

    const date = parseISODate(dayElement.getAttribute(DATA_ATTRIBUTES.date));

    if (!date || isSameDay(date, this.state.previewDate)) {
      return;
    }

    this.state.previewDate = cloneDate(date);

    this.render();
  }

  clearRangePreview() {
    if (!this.state.previewDate) {
      return;
    }

    this.state.previewDate = null;
    this.render();
  }

  /* ==========================================================================
     Date Constraints
     ========================================================================== */

  isDateDisabled(date, { boundary = this.state.activeBoundary } = {}) {
    if (!date) return true;

    const today = getToday();

    if (this.config.minimumDate && isBefore(date, this.config.minimumDate)) {
      return true;
    }

    if (this.config.maximumDate && isAfter(date, this.config.maximumDate)) {
      return true;
    }

    if (this.config.disablePast && isBefore(date, today)) {
      return true;
    }

    if (this.config.disableFuture && isAfter(date, today)) {
      return true;
    }

    if (this.config.disabledWeekdays.has(date.getDay())) {
      return true;
    }

    if (
      this.isRange &&
      boundary === BOUNDARIES.end &&
      this.state.draftStart &&
      isBefore(date, this.state.draftStart)
    ) {
      return true;
    }

    return false;
  }

  isRangeSelectable(startDate, endDate) {
    if (!startDate || !endDate) {
      return false;
    }

    if (isAfter(startDate, endDate)) {
      return false;
    }

    return !(
      this.isDateDisabled(startDate, {
        boundary: BOUNDARIES.start,
      }) ||
      this.isDateDisabled(endDate, {
        boundary: BOUNDARIES.end,
      })
    );
  }

  /* ==========================================================================
     Date Selection
     ========================================================================== */

  selectDate(date, { source = "api" } = {}) {
    if (!date || this.isDateDisabled(date)) {
      return false;
    }

    this.state.activeDate = cloneDate(date);

    if (!this.isRange) {
      this.state.draftStart = cloneDate(date);

      this.commitValues(date, null, {
        source,
        syncDraft: true,
      });

      this.announce(
        this.messages.dateSelected(
          formatAccessibleDate(date, this.config.locale),
        ),
      );

      this.markDateAsSelected(date);

      this.close({
        returnFocus: true,
        resolveDraft: false,
        source,
      });

      return true;
    }

    if (
      this.state.activeBoundary === BOUNDARIES.start ||
      !this.state.draftStart ||
      this.state.draftEnd
    ) {
      this.state.draftStart = cloneDate(date);

      this.state.draftEnd = null;
      this.state.previewDate = null;

      this.setActiveBoundary(BOUNDARIES.end);

      this.render({
        focusCalendar: true,
      });

      this.announce(
        this.messages.rangeStartSelected(
          formatAccessibleDate(date, this.config.locale),
        ),
      );

      return true;
    }

    if (isBefore(date, this.state.draftStart)) {
      return false;
    }

    this.state.draftEnd = cloneDate(date);

    this.state.previewDate = null;

    /**
     * A complete range is committed immediately. Apply remains available as
     * an explicit confirmation-and-close action, but is no longer required to
     * preserve the selected values.
     */
    this.commitValues(this.state.draftStart, this.state.draftEnd, {
      source,
      syncDraft: true,
    });

    this.render({
      focusCalendar: true,
    });

    this.announce(
      this.messages.rangeSelected(
        formatAccessibleDate(this.state.draftStart, this.config.locale),
        formatAccessibleDate(this.state.draftEnd, this.config.locale),
      ),
    );

    return true;
  }

  setActiveBoundary(boundary) {
    if (boundary !== BOUNDARIES.start && boundary !== BOUNDARIES.end) {
      return;
    }

    this.state.activeBoundary = boundary;

    this.component.setAttribute(DATA_ATTRIBUTES.activeBoundary, boundary);

    this.announce(this.messages.activeBoundary(boundary));
  }

  markDateAsSelected(date) {
    const record = this.calendarRecords.dayRecords.find((item) =>
      isSameDay(item.date, date),
    );

    if (!record) return;

    record.element.classList.add(CLASS_NAMES.justSelected);
  }

  /* ==========================================================================
     Presets
     ========================================================================== */

  applyPreset(preset) {
    const range = getPresetRange(preset);

    if (!range || !this.isRangeSelectable(range.startDate, range.endDate)) {
      return false;
    }

    this.state.draftStart = cloneDate(range.startDate);

    this.state.draftEnd = cloneDate(range.endDate);

    this.state.activeDate = cloneDate(range.endDate);

    this.state.activeBoundary = BOUNDARIES.end;

    this.state.primaryViewDate = startOfMonth(range.startDate);

    this.state.previewDate = null;

    this.state.panelView = VIEWS.days;

    this.commitValues(this.state.draftStart, this.state.draftEnd, {
      source: `preset:${preset}`,
      syncDraft: true,
    });

    this.render({
      focusCalendar: true,
    });

    this.announce(
      this.messages.rangeSelected(
        formatAccessibleDate(range.startDate, this.config.locale),
        formatAccessibleDate(range.endDate, this.config.locale),
      ),
    );

    return true;
  }

  selectToday() {
    const today = getToday();

    if (!today || this.isDateDisabled(today)) {
      return false;
    }

    return this.selectDate(today, {
      source: "today",
    });
  }

  /* ==========================================================================
     Apply Range
     ========================================================================== */

  applyRange({ source = "apply" } = {}) {
    if (
      !this.isRange ||
      !this.isRangeSelectable(this.state.draftStart, this.state.draftEnd)
    ) {
      return false;
    }

    this.commitValues(this.state.draftStart, this.state.draftEnd, {
      source,
      syncDraft: true,
    });

    this.close({
      returnFocus: true,
      resolveDraft: false,
      source,
    });

    return true;
  }

  /* ==========================================================================
     Clear
     ========================================================================== */

  clear({ emit = true, source = "api", keepOpen = this.state.open } = {}) {
    if (
      this.state.destroyed ||
      this.isDisabled ||
      this.isReadonly ||
      this.isLoading
    ) {
      return false;
    }

    const changed =
      Boolean(this.startInput.value) || Boolean(this.endInput?.value);

    /**
     * Update draft state before rendering committed values. This removes the
     * previous one-interaction delay.
     */
    this.state.draftStart = null;
    this.state.draftEnd = null;
    this.state.previewDate = null;

    this.state.activeBoundary = BOUNDARIES.start;

    this.state.activeDate = getToday();

    this.state.primaryViewDate = startOfMonth(this.state.activeDate);

    this.commitValues(null, null, {
      emit,
      source,
      syncDraft: true,
    });

    this.component.setAttribute(
      DATA_ATTRIBUTES.activeBoundary,
      BOUNDARIES.start,
    );

    this.announce(
      this.isRange ? this.messages.rangeCleared : this.messages.dateCleared,
    );

    dispatchComponentEvent(this.component, COMPONENT_EVENTS.clear, {
      instance: this,
      mode: this.mode,
      source,
    });

    if (keepOpen && this.state.open) {
      this.render({
        focusCalendar: true,
      });
    } else if (this.state.open) {
      this.close({
        returnFocus: true,
        resolveDraft: false,
        source,
      });
    } else {
      this.renderValue();
    }

    return changed;
  }

  /* ==========================================================================
     Commit Native Values
     ========================================================================== */

  commitValues(
    startDate,
    endDate,
    { emit = true, source = "api", syncDraft = true } = {},
  ) {
    const beforeSignature = getValueSignature(this.startInput, this.endInput);

    const startValue = formatISODate(startDate);

    const endValue = this.isRange ? formatISODate(endDate) : "";

    this.startInput.value = startValue;

    if (this.endInput) {
      this.endInput.value = endValue;
    }

    this.state.committedStart = cloneDate(startDate);

    this.state.committedEnd = this.isRange ? cloneDate(endDate) : null;

    if (syncDraft) {
      this.state.draftStart = cloneDate(startDate);

      this.state.draftEnd = this.isRange ? cloneDate(endDate) : null;
    }

    const changed =
      beforeSignature !== getValueSignature(this.startInput, this.endInput);

    this.syncControlState();
    this.renderValue();

    if (changed && emit) {
      this.dispatchNativeEvents();
      this.emitChange({
        source,
      });
    }

    return changed;
  }

  dispatchNativeEvents() {
    const EventConstructor = this.view.Event;

    this.state.dispatchingNativeEvents = true;

    try {
      this.startInput.dispatchEvent(
        new EventConstructor(DOM_EVENTS.input, {
          bubbles: true,
        }),
      );

      this.startInput.dispatchEvent(
        new EventConstructor(DOM_EVENTS.change, {
          bubbles: true,
        }),
      );

      if (this.endInput) {
        this.endInput.dispatchEvent(
          new EventConstructor(DOM_EVENTS.input, {
            bubbles: true,
          }),
        );

        this.endInput.dispatchEvent(
          new EventConstructor(DOM_EVENTS.change, {
            bubbles: true,
          }),
        );
      }
    } finally {
      this.state.dispatchingNativeEvents = false;
    }
  }

  emitChange({ source = "api" } = {}) {
    const startValue = this.startInput.value || "";

    const endValue = this.endInput?.value || "";

    const value = this.isRange
      ? {
          start: startValue,
          end: endValue,
        }
      : startValue;

    const detail = {
      value,
      start: startValue || null,
      end: this.isRange ? endValue || null : null,

      startDate: cloneDate(this.state.committedStart),

      endDate: cloneDate(this.state.committedEnd),

      range: this.isRange,
      native: this.startInput,
      startInput: this.startInput,
      endInput: this.endInput,
      source,
    };

    dispatchComponentEvent(this.component, COMPONENT_EVENTS.change, detail);

    const actionName =
      this.component.getAttribute(DATA_ATTRIBUTES.action) ||
      this.component.dataset.onchange;

    const action = actionName && this.view[actionName];

    if (typeof action === "function") {
      action(value, this.component, detail);
    }
  }

  /* ==========================================================================
     Rendering
     ========================================================================== */

  render({ focusCalendar = false, focusPicker = false } = {}) {
    if (this.state.destroyed) {
      return;
    }

    const selectedStart = this.state.open
      ? this.state.draftStart
      : this.state.committedStart;

    const selectedEnd = this.state.open
      ? this.state.draftEnd
      : this.state.committedEnd;

    this.calendarRecords = renderCustomDateCalendars({
      container: this.calendarsElement,

      mode: this.mode,

      primaryViewDate: this.state.primaryViewDate,

      panelView: this.state.panelView,

      pickerSide: this.state.pickerSide,

      locale: this.config.locale,

      firstDayOfWeek: this.config.firstDayOfWeek,

      selectedStart,
      selectedEnd,

      previewDate: this.state.previewDate,

      activeBoundary: this.state.activeBoundary,

      activeDate: this.state.activeDate,

      minimumDate: this.config.minimumDate,

      maximumDate: this.config.maximumDate,

      isDateDisabled: (date) => this.isDateDisabled(date),

      messages: this.messages,
    });

    this.renderPresets();
    this.renderFooterState();
    this.renderValue();

    this.positioner.schedule();

    if (focusPicker) {
      queueMicrotask(() => {
        if (!this.state.destroyed) {
          this.focusActivePickerOption();
        }
      });
    } else if (focusCalendar) {
      queueMicrotask(() => {
        if (!this.state.destroyed) {
          this.focusActiveDate();
        }
      });
    }
  }

  renderPresets() {
    if (!this.isRange || !this.presetsElement) {
      this.presetRecords = [];
      return;
    }

    const result = renderCustomDatePresets({
      container: this.presetsElement,

      presets: this.config.presets,

      messages: this.messages,

      selectedStart: this.state.draftStart,

      selectedEnd: this.state.draftEnd,

      isDateDisabled: (date) => this.isDateDisabled(date),

      isRangeSelectable: (startDate, endDate) =>
        this.isRangeSelectable(startDate, endDate),
    });

    this.presetRecords = result.records;
  }

  renderFooterState() {
    const startDate = this.state.open
      ? this.state.draftStart
      : this.state.committedStart;

    const endDate = this.state.open
      ? this.state.draftEnd
      : this.state.committedEnd;

    const hasValue = this.isRange
      ? Boolean(startDate || endDate)
      : Boolean(startDate);

    if (this.clearActionElement) {
      this.clearActionElement.disabled = !hasValue;
    }

    if (this.applyActionElement) {
      this.applyActionElement.disabled = !this.isRangeSelectable(
        startDate,
        endDate,
      );
    }

    if (this.isRange && this.summaryValueElement) {
      const complete = Boolean(startDate && endDate);

      this.summaryValueElement.classList.toggle(
        CLASS_NAMES.placeholder,
        !complete,
      );

      this.summaryValueElement.textContent = complete
        ? `${formatISODate(startDate)} ` +
          `${DEFAULTS.rangeSeparator} ` +
          formatISODate(endDate)
        : this.messages.noRangeSelected;
    }

    if (this.presetsElement) {
      syncCustomDatePresetState({
        records: this.presetRecords,

        selectedStart: startDate,

        selectedEnd: endDate,
      });
    }
  }

  renderValue() {
    const startDate = this.state.open
      ? this.state.draftStart
      : this.state.committedStart;

    const endDate = this.state.open
      ? this.state.draftEnd
      : this.state.committedEnd;

    if (!this.isRange) {
      const hasValue = Boolean(startDate);

      this.valueElement.textContent = hasValue
        ? formatISODate(startDate)
        : this.config.placeholder;

      this.valueElement.classList.toggle(CLASS_NAMES.placeholder, !hasValue);

      this.component.classList.toggle(CLASS_NAMES.hasValue, hasValue);

      if (this.clearElement) {
        this.clearElement.hidden = !hasValue;
      }

      return;
    }

    const hasStart = Boolean(startDate);

    const hasEnd = Boolean(endDate);

    const hasValue = hasStart || hasEnd;

    this.startValueElement.textContent = hasStart
      ? formatISODate(startDate)
      : "YYYY-MM-DD";

    this.endValueElement.textContent = hasEnd
      ? formatISODate(endDate)
      : "YYYY-MM-DD";

    this.startValueElement.classList.toggle(CLASS_NAMES.placeholder, !hasStart);

    this.endValueElement.classList.toggle(CLASS_NAMES.placeholder, !hasEnd);

    this.component.classList.toggle(CLASS_NAMES.hasValue, hasValue);

    if (this.clearElement) {
      this.clearElement.hidden = !hasValue;
    }
  }

  /* ==========================================================================
     Native Synchronization
     ========================================================================== */

  handleNativeChange() {
    if (this.state.dispatchingNativeEvents) {
      return;
    }

    this.state.committedStart = parseISODate(this.startInput.value);

    this.state.committedEnd = parseISODate(this.endInput?.value);

    this.state.draftStart = cloneDate(this.state.committedStart);

    this.state.draftEnd = cloneDate(this.state.committedEnd);

    this.sync({
      preserveView: true,
    });

    this.emitChange({
      source: "native",
    });
  }

  redirectNativeFocus(boundary) {
    this.component.classList.add(CLASS_NAMES.nativeFocused);

    this.view.setTimeout(() => {
      if (this.state.destroyed) {
        return;
      }

      this.component.classList.remove(CLASS_NAMES.nativeFocused);

      focusSafely(this.triggerElement);

      if (this.isRange && boundary) {
        this.state.activeBoundary = boundary;
      }
    }, 0);
  }

  handleNativeInvalid(boundary) {
    this.syncControlState();

    this.state.activeBoundary = boundary || BOUNDARIES.start;

    this.view.setTimeout(() => {
      if (this.state.destroyed) {
        return;
      }

      focusSafely(this.triggerElement);
    }, 0);
  }

  /* ==========================================================================
     Control State Synchronization
     ========================================================================== */

  syncControlState() {
    const disabled = this.isDisabled;

    const readonly = this.isReadonly;

    const loading = this.isLoading;

    const startInvalid = this.startInput.getAttribute(ARIA.invalid);

    const endInvalid = this.endInput?.getAttribute(ARIA.invalid);

    const invalid =
      (startInvalid && startInvalid !== "false") ||
      (endInvalid && endInvalid !== "false");

    const required =
      this.startInput.required || Boolean(this.endInput?.required);

    this.triggerElement.disabled = disabled || loading;

    this.triggerElement.setAttribute(
      ARIA.disabled,
      String(disabled || readonly || loading),
    );

    restoreAttribute(
      this.triggerElement,
      ARIA.invalid,
      invalid ? "true" : null,
    );

    restoreAttribute(
      this.triggerElement,
      ARIA.required,
      required ? "true" : null,
    );

    restoreAttribute(this.triggerElement, ARIA.busy, loading ? "true" : null);

    this.component.classList.toggle(CLASS_NAMES.disabled, disabled);

    this.component.classList.toggle(CLASS_NAMES.readonly, readonly);

    if ((disabled || readonly || loading) && this.state.open) {
      this.close({
        immediate: true,
        resolveDraft: true,
      });
    }
  }

  /* ==========================================================================
     Complete Synchronization
     ========================================================================== */

  sync({ preserveView = true } = {}) {
    if (this.state.destroyed) {
      return;
    }

    this.config = this.readConfiguration();

    this.state.committedStart = parseISODate(this.startInput.value);

    this.state.committedEnd = parseISODate(this.endInput?.value);

    if (!this.state.open) {
      this.state.draftStart = cloneDate(this.state.committedStart);

      this.state.draftEnd = cloneDate(this.state.committedEnd);
    }

    if (!preserveView) {
      const preferredDate =
        this.state.committedStart || this.state.committedEnd || getToday();

      this.state.primaryViewDate = startOfMonth(preferredDate);

      this.state.activeDate = cloneDate(preferredDate);
    }

    this.syncControlState();
    this.renderValue();

    if (this.state.open) {
      this.render();
    }
  }

  /* ==========================================================================
     Messages
     ========================================================================== */

  refreshMessages() {
    this.messages = getCustomDateMessages(this.component);

    this.config.locale = this.messages.locale;

    if (!this.triggerElement.hasAttribute(ARIA.labelledBy)) {
      this.triggerElement.setAttribute(
        ARIA.label,
        this.isRange ? this.messages.rangeDialog : this.messages.calendarDialog,
      );
    }

    if (this.clearElement) {
      this.clearElement.setAttribute(
        ARIA.label,
        this.isRange ? this.messages.clearRange : this.messages.clearDate,
      );
    }

    if (this.presetsLabelElement) {
      this.presetsLabelElement.textContent = this.messages.presetsLabel;
    }

    if (this.summaryLabelElement) {
      this.summaryLabelElement.textContent = this.messages.selectedRange;
    }

    if (this.todayActionElement) {
      this.todayActionElement.textContent = this.messages.today;
    }

    if (this.clearActionElement) {
      this.clearActionElement.textContent = this.messages.clear;
    }

    if (this.cancelActionElement) {
      this.cancelActionElement.textContent = this.messages.cancel;
    }

    if (this.applyActionElement) {
      this.applyActionElement.textContent = this.messages.apply;
    }
  }

  announce(message) {
    if (!message || this.state.destroyed) {
      return;
    }

    this.clearAnnouncementTimer();

    this.statusElement.textContent = "";

    this.announcementTimer = this.view.setTimeout(() => {
      this.announcementTimer = null;

      if (!this.state.destroyed) {
        this.statusElement.textContent = message;
      }
    }, 0);
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  refresh() {
    if (this.state.destroyed) {
      return this;
    }

    this.refreshMessages();

    this.sync({
      preserveView: this.state.open,
    });

    return this;
  }

  setValue(value, { emit = true, source = "api" } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    if (!this.isRange) {
      const date =
        value instanceof Date
          ? cloneDate(value)
          : parseISODate(value == null ? "" : String(value));

      if (
        date &&
        this.isDateDisabled(date, {
          boundary: BOUNDARIES.start,
        })
      ) {
        return false;
      }

      return this.commitValues(date, null, {
        emit,
        source,
        syncDraft: true,
      });
    }

    const startValue = value?.start ?? null;

    const endValue = value?.end ?? null;

    const startDate =
      startValue instanceof Date
        ? cloneDate(startValue)
        : parseISODate(startValue == null ? "" : String(startValue));

    const endDate =
      endValue instanceof Date
        ? cloneDate(endValue)
        : parseISODate(endValue == null ? "" : String(endValue));

    if ((startDate || endDate) && !this.isRangeSelectable(startDate, endDate)) {
      return false;
    }

    return this.commitValues(startDate, endDate, {
      emit,
      source,
      syncDraft: true,
    });
  }

  setLoading(isLoading = true) {
    const loading = Boolean(isLoading);

    this.component.classList.toggle(CLASS_NAMES.loading, loading);

    restoreAttribute(this.component, ARIA.busy, loading ? "true" : null);

    this.syncControlState();

    if (loading) {
      this.announce(this.messages.loading);
    }

    return this;
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    const activeElementWasInside = this.interfaceElement.contains(
      this.document.activeElement,
    );

    this.close({
      immediate: true,
      emit: false,
      resolveDraft: false,
    });

    this.state.destroyed = true;

    this.abortController.abort();
    this.mutationObserver?.disconnect();
    this.positioner.destroy();

    this.clearCloseTimer();
    this.clearAnnouncementTimer();
    this.clearResetTimer();

    this.interfaceElement.remove();

    restoreAttribute(this.startInput, "id", this.original.startId);

    restoreAttribute(this.startInput, "tabindex", this.original.startTabIndex);

    if (this.endInput) {
      restoreAttribute(this.endInput, "id", this.original.endId);

      restoreAttribute(this.endInput, "tabindex", this.original.endTabIndex);
    }

    if (this.original.labelElement) {
      restoreAttribute(this.original.labelElement, "id", this.original.labelId);
    }

    if (this.original.legendElement) {
      restoreAttribute(
        this.original.legendElement,
        "id",
        this.original.legendId,
      );
    }

    this.component.classList.remove(
      CLASS_NAMES.enhanced,
      CLASS_NAMES.enhancementFailed,
      CLASS_NAMES.open,
      CLASS_NAMES.openUp,
      CLASS_NAMES.positioned,
      CLASS_NAMES.closing,
      CLASS_NAMES.disabled,
      CLASS_NAMES.readonly,
      CLASS_NAMES.loading,
      CLASS_NAMES.nativeFocused,
      CLASS_NAMES.hasValue,
    );

    this.component.classList.toggle(
      CLASS_NAMES.range,
      this.original.componentRangeClass,
    );

    this.component.removeAttribute(DATA_ATTRIBUTES.activeBoundary);

    if (activeInstance === this) {
      activeInstance = null;
    }

    instances.delete(this.component);

    if (activeElementWasInside) {
      focusSafely(this.startInput);
    }
  }

  /* ==========================================================================
     Timer Cleanup
     ========================================================================== */

  clearCloseTimer() {
    if (this.closeTimer === null) {
      return;
    }

    this.view.clearTimeout(this.closeTimer);

    this.closeTimer = null;
  }

  clearAnnouncementTimer() {
    if (this.announcementTimer === null) {
      return;
    }

    this.view.clearTimeout(this.announcementTimer);

    this.announcementTimer = null;
  }

  clearResetTimer() {
    if (this.resetTimer === null) {
      return;
    }

    this.view.clearTimeout(this.resetTimer);

    this.resetTimer = null;
  }
}
