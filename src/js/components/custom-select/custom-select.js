import {
  ARIA,
  CLASS_NAMES,
  COMPONENT_EVENTS,
  DATA_ATTRIBUTES,
  DEFAULTS,
  DOM_EVENTS,
  KEYS,
  SELECTORS,
} from "./constants";
import { createCustomSelectMarkup, renderCustomSelectOptions } from "./markup";
import { getCustomSelectMessages } from "./messages";
import { CustomSelectPositioner } from "./position";
import {
  createElement,
  dispatchComponentEvent,
  escapeRegularExpression,
  focusSafely,
  getAssociatedLabel,
  getOptionLabel,
  getSelectedOptions,
  isOptionDisabled,
  isPrintableKey,
  normalizeSearchText,
  readCssTime,
} from "./utils";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();
let activeInstance = null;

/* ==========================================================================
   Private Helpers
   ========================================================================== */

function isSelectElement(element) {
  return element?.tagName === "SELECT";
}

function getComponentNativeSelect(component) {
  const native = component?.querySelector?.(SELECTORS.native);

  return isSelectElement(native) ? native : null;
}

function optionIsPlaceholder(option) {
  if (!option) return true;

  return (
    option.value === "" &&
    (option.disabled || option.hidden || option.dataset.placeholder === "true")
  );
}

function getChangeSignature(native) {
  return JSON.stringify(
    Array.from(native.options).map((option) => Boolean(option.selected)),
  );
}

function restoreAttribute(element, name, value) {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}

/* ==========================================================================
   Custom Select
   ========================================================================== */

/**
 * Progressively enhances one native select.
 *
 * The native control remains the source of truth for values, form submission,
 * constraint validation, reset, autofill, and external application updates.
 */

export class CustomSelect {
  static getInstance(component) {
    return instances.get(component) || null;
  }

  static getOrCreateInstance(component, options = {}) {
    const existingInstance = CustomSelect.getInstance(component);

    if (existingInstance) return existingInstance;

    try {
      return new CustomSelect(component, options);
    } catch (error) {
      component?.classList?.add(CLASS_NAMES.enhancementFailed);
      console.error("Unable to initialize custom select.", error);
      return null;
    }
  }

  constructor(component, options = {}) {
    if (!component?.matches?.(SELECTORS.component)) {
      throw new TypeError(
        `CustomSelect requires an element matching "${SELECTORS.component}".`,
      );
    }

    if (instances.has(component)) {
      throw new Error("This custom select has already been initialized.");
    }

    const native = getComponentNativeSelect(component);

    if (!native) {
      throw new TypeError(
        `CustomSelect requires a native select matching "${SELECTORS.native}".`,
      );
    }

    this.component = component;
    this.native = native;
    this.document = component.ownerDocument;
    this.view = this.document.defaultView;
    this.form = native.form;

    this.options = Object.freeze({
      closeDuration: Number.isFinite(options.closeDuration)
        ? Math.max(0, options.closeDuration)
        : null,
      typeaheadDelay: Number.isFinite(options.typeaheadDelay)
        ? Math.max(0, options.typeaheadDelay)
        : DEFAULTS.typeaheadDelay,
    });

    this.state = {
      activeRecord: null,
      closing: false,
      destroyed: false,
      dispatchingNativeEvents: false,
      open: false,
      query: "",
      refreshQueued: false,
      typeahead: "",
    };

    this.closeTimer = null;
    this.announcementTimer = null;
    this.resetTimer = null;
    this.typeaheadTimer = null;

    this.abortController = new this.view.AbortController();
    this.messages = getCustomSelectMessages(component);

    const associatedLabel = getAssociatedLabel(native);

    this.original = Object.freeze({
      componentMultipleClass: component.classList.contains(
        CLASS_NAMES.multiple,
      ),
      labelElement: associatedLabel,
      labelId: associatedLabel?.getAttribute("id") ?? null,
      nativeId: native.getAttribute("id"),
      nativeTabIndex: native.getAttribute("tabindex"),
    });

    const markup = createCustomSelectMarkup({
      component,
      native,
      messages: this.messages,
    });

    Object.assign(this, markup);

    this.positioner = new CustomSelectPositioner({
      component,
      anchor: this.controlElement,
      popover: this.popoverElement,
    });

    this.component.classList.toggle(CLASS_NAMES.multiple, native.multiple);
    this.component.classList.remove(CLASS_NAMES.enhancementFailed);
    this.native.setAttribute("tabindex", "-1");
    this.component.append(this.interfaceElement);
    this.component.classList.add(CLASS_NAMES.enhanced);

    this.bindEvents();
    this.observeChanges();
    this.sync({ preserveActive: false });

    instances.set(component, this);
  }

  /* ==========================================================================
     Public State
     ========================================================================== */

  get isOpen() {
    return this.state.open;
  }

  get isDisabled() {
    return Boolean(
      this.native.disabled ||
      this.component.hasAttribute("disabled") ||
      this.component.classList.contains(CLASS_NAMES.disabled) ||
      this.component.getAttribute(ARIA.disabled) === "true",
    );
  }

  get isLoading() {
    return Boolean(
      this.component.classList.contains(CLASS_NAMES.loading) ||
      this.component.getAttribute(ARIA.busy) === "true",
    );
  }

  get value() {
    if (!this.native.multiple) {
      return this.native.value;
    }

    return getSelectedOptions(this.native).map((option) => option.value);
  }

  get selectedOptions() {
    return getSelectedOptions(this.native);
  }

  /* ==========================================================================
     Event Binding
     ========================================================================== */

  listen(target, type, listener, options = {}) {
    if (!target?.addEventListener) return;

    target.addEventListener(type, listener, {
      ...options,
      signal: this.abortController.signal,
    });
  }

  bindEvents() {
    this.listen(this.triggerElement, DOM_EVENTS.click, () => {
      this.toggle();
    });

    this.listen(this.triggerElement, DOM_EVENTS.keydown, (event) => {
      this.handleTriggerKeydown(event);
    });

    this.listen(this.listboxElement, DOM_EVENTS.pointerdown, (event) => {
      if (event.target.closest(SELECTORS.option)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    this.listen(this.listboxElement, "pointermove", (event) => {
      const record = this.getRecordFromEvent(event);

      if (record && this.isRecordNavigable(record)) {
        this.setActiveRecord(record, { scroll: false });
      }
    });

    this.listen(this.listboxElement, DOM_EVENTS.click, (event) => {
      const record = this.getRecordFromEvent(event);

      if (!record) return;

      event.preventDefault();
      event.stopPropagation();
      this.selectRecord(record, { source: "pointer" });
    });

    if (this.clearElement) {
      this.listen(this.clearElement, DOM_EVENTS.pointerdown, (event) => {
        event.preventDefault();
      });

      this.listen(this.clearElement, DOM_EVENTS.click, (event) => {
        event.preventDefault();
        event.stopPropagation();

        this.clear({ source: "clear" });
        focusSafely(this.triggerElement);
      });
    }

    if (this.searchInputElement) {
      this.listen(this.searchInputElement, DOM_EVENTS.input, () => {
        this.applySearch(this.searchInputElement.value, { announce: true });
      });

      this.listen(this.searchInputElement, DOM_EVENTS.keydown, (event) => {
        this.handleSearchKeydown(event);
      });

      this.listen(this.searchInputElement, DOM_EVENTS.focus, () => {
        this.syncActiveDescendant();
      });
    }

    if (this.searchClearElement) {
      this.listen(this.searchClearElement, DOM_EVENTS.pointerdown, (event) => {
        event.preventDefault();
      });

      this.listen(this.searchClearElement, DOM_EVENTS.click, (event) => {
        event.preventDefault();

        this.clearSearch({ announce: true, focus: true });
      });
    }

    this.listen(this.native, DOM_EVENTS.change, () => {
      if (this.state.dispatchingNativeEvents) return;

      this.sync({ preserveActive: true });
      this.emitChange({ source: "native" });
    });

    this.listen(this.native, DOM_EVENTS.focus, () => {
      this.component.classList.add(CLASS_NAMES.nativeFocused);

      this.view.setTimeout(() => {
        if (!this.state.destroyed) {
          focusSafely(this.triggerElement);
        }
      }, 0);
    });

    this.listen(this.native, DOM_EVENTS.blur, () => {
      this.component.classList.remove(CLASS_NAMES.nativeFocused);
    });

    this.listen(this.native, "invalid", () => {
      this.syncControlState();

      this.view.setTimeout(() => {
        if (!this.state.destroyed) {
          focusSafely(this.triggerElement);
        }
      }, 0);
    });

    if (this.form) {
      this.listen(this.form, DOM_EVENTS.reset, () => {
        this.close({ immediate: true });
        this.clearScheduledReset();

        this.resetTimer = this.view.setTimeout(() => {
          this.resetTimer = null;

          if (!this.state.destroyed) {
            this.sync({ preserveActive: false });
          }
        }, 0);
      });
    }

    this.listen(this.document, DOM_EVENTS.pointerdown, (event) => {
      if (!this.state.open || this.component.contains(event.target)) return;

      this.close();
    });

    const closeOnOutsideScrollIntent = (event) => {
      if (!this.state.open) return;

      const target = event.target;
      const isPopoverInteraction =
        target instanceof this.view.Node &&
        this.popoverElement.contains(target);

      if (!isPopoverInteraction) {
        this.close();
      }
    };

    this.listen(this.document, "wheel", closeOnOutsideScrollIntent, {
      capture: true,
      passive: true,
    });

    this.listen(this.document, "touchmove", closeOnOutsideScrollIntent, {
      capture: true,
      passive: true,
    });

    this.listen(this.view, DOM_EVENTS.resize, () => {
      this.syncMultipleSummary();
    });

    this.listen(this.view, "languagechange", () => {
      this.refreshMessages();
      this.sync({ preserveActive: true });
    });
  }

  /* ==========================================================================
     Mutation Synchronization
     ========================================================================== */

  observeChanges() {
    if (typeof this.view.MutationObserver !== "function") return;

    this.mutationObserver = new this.view.MutationObserver((mutations) => {
      if (this.state.destroyed) return;

      const onlyControlStateChanged = mutations.every(
        (mutation) =>
          mutation.type === "attributes" &&
          mutation.target === this.native &&
          ["aria-describedby", "aria-invalid", "disabled", "required"].includes(
            mutation.attributeName,
          ),
      );

      if (onlyControlStateChanged) {
        this.syncControlState();
        return;
      }

      this.scheduleRefresh();
    });

    this.mutationObserver.observe(this.native, {
      attributes: true,
      attributeFilter: [
        "aria-describedby",
        "aria-invalid",
        "aria-label",
        "aria-labelledby",
        "disabled",
        "hidden",
        "label",
        "multiple",
        "required",
        "selected",
        "value",
      ],
      childList: true,
      subtree: true,
    });

    this.mutationObserver.observe(this.component, {
      attributes: true,
      attributeFilter: [
        ARIA.disabled,
        ARIA.busy,
        "disabled",
        DATA_ATTRIBUTES.placeholder,
        DATA_ATTRIBUTES.searchPlaceholder,
        DATA_ATTRIBUTES.emptyMessage,
        DATA_ATTRIBUTES.clearLabel,
      ],
    });
  }

  scheduleRefresh() {
    if (this.state.refreshQueued) return;

    this.state.refreshQueued = true;

    queueMicrotask(() => {
      this.state.refreshQueued = false;

      if (!this.state.destroyed) {
        this.refresh();
      }
    });
  }

  /* ==========================================================================
     Open and Close
     ========================================================================== */

  toggle(force) {
    const shouldOpen = typeof force === "boolean" ? force : !this.state.open;

    return shouldOpen ? this.open() : this.close({ returnFocus: true });
  }

  open({ focusSearch = true } = {}) {
    if (this.state.destroyed || this.isDisabled || this.isLoading) return false;

    if (this.state.open) {
      if (focusSearch && this.searchInputElement) {
        focusSafely(this.searchInputElement);
      }

      return true;
    }

    const beforeOpenEvent = dispatchComponentEvent(
      this.component,
      COMPONENT_EVENTS.beforeOpen,
      {
        instance: this,
        native: this.native,
      },
      { cancelable: true },
    );

    if (beforeOpenEvent?.defaultPrevented) return false;

    if (activeInstance && activeInstance !== this) {
      activeInstance.close({ immediate: true });
    }

    activeInstance = this;

    this.clearCloseTimer();
    this.refreshMessages();
    this.clearSearch({ announce: false, focus: false });

    this.state.open = true;
    this.state.closing = false;

    this.component.classList.add(CLASS_NAMES.open);
    this.popoverElement.classList.remove(CLASS_NAMES.closing);
    this.popoverElement.classList.add(CLASS_NAMES.open);
    this.triggerElement.setAttribute(ARIA.expanded, "true");

    this.showNativePopover();
    this.positioner.start();

    const initialRecord =
      this.getSelectedNavigableRecord() ||
      this.getNavigableRecords()[0] ||
      null;

    if (focusSearch && this.searchInputElement) {
      focusSafely(this.searchInputElement);
    }

    this.setActiveRecord(initialRecord, { scroll: true });

    dispatchComponentEvent(this.component, COMPONENT_EVENTS.open, {
      instance: this,
      native: this.native,
    });

    return true;
  }

  close({ immediate = false, returnFocus = false, emit = true } = {}) {
    if (this.state.destroyed && !immediate) return false;
    if (!this.state.open && !this.state.closing) return false;

    const wasOpen = this.state.open;

    this.state.open = false;
    this.state.closing = !immediate;

    if (activeInstance === this) {
      activeInstance = null;
    }

    this.component.classList.remove(CLASS_NAMES.open);
    this.popoverElement.classList.remove(CLASS_NAMES.open);
    this.triggerElement.setAttribute(ARIA.expanded, "false");
    this.clearActiveRecord();
    this.positioner.stop();
    this.hideNativePopover();

    if (returnFocus && !this.state.destroyed) {
      focusSafely(this.triggerElement);
    }

    if (emit && wasOpen) {
      dispatchComponentEvent(this.component, COMPONENT_EVENTS.close, {
        instance: this,
        native: this.native,
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
        "--custom-select-popover-duration",
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

  finishClose() {
    this.state.closing = false;
    this.popoverElement.classList.remove(CLASS_NAMES.closing);
    this.positioner.stop({ reset: true });
    this.clearSearch({ announce: false, focus: false });
  }

  showNativePopover() {
    if (typeof this.popoverElement.showPopover !== "function") return;

    try {
      this.popoverElement.showPopover();
    } catch {
      // The class-based fallback remains fully functional.
    }
  }

  hideNativePopover() {
    if (typeof this.popoverElement.hidePopover !== "function") return;

    try {
      this.popoverElement.hidePopover();
    } catch {
      // The class-based fallback remains fully functional.
    }
  }

  /* ==========================================================================
     Keyboard Interaction
     ========================================================================== */

  handleTriggerKeydown(event) {
    if (this.isDisabled || this.isLoading) return;

    switch (event.key) {
      case KEYS.arrowDown:
        event.preventDefault();

        if (this.state.open) {
          this.moveActive(1);
        } else {
          this.open({ focusSearch: false });
        }

        return;

      case KEYS.arrowUp:
        event.preventDefault();

        if (this.state.open) {
          this.moveActive(-1);
        } else {
          this.open({ focusSearch: false });
        }

        return;

      case KEYS.home:
        if (!this.state.open) return;

        event.preventDefault();
        this.moveActiveToBoundary("start");
        return;

      case KEYS.end:
        if (!this.state.open) return;

        event.preventDefault();
        this.moveActiveToBoundary("end");
        return;

      case KEYS.pageDown:
        if (!this.state.open) return;

        event.preventDefault();
        this.moveActive(10);
        return;

      case KEYS.pageUp:
        if (!this.state.open) return;

        event.preventDefault();
        this.moveActive(-10);
        return;

      case KEYS.enter:
      case KEYS.space:
        event.preventDefault();

        if (!this.state.open) {
          this.open();
        } else if (this.state.activeRecord) {
          this.selectRecord(this.state.activeRecord, { source: "keyboard" });
        }

        return;

      case KEYS.escape:
        if (!this.state.open) return;

        event.preventDefault();
        this.close({ returnFocus: true });
        return;

      case KEYS.tab:
        if (this.state.open) {
          this.close();
        }

        return;

      default:
        if (isPrintableKey(event)) {
          this.handlePrintableKey(event);
        }
    }
  }

  handleSearchKeydown(event) {
    switch (event.key) {
      case KEYS.arrowDown:
        event.preventDefault();
        this.moveActive(1);
        return;

      case KEYS.arrowUp:
        event.preventDefault();
        this.moveActive(-1);
        return;

      case KEYS.pageDown:
        event.preventDefault();
        this.moveActive(10);
        return;

      case KEYS.pageUp:
        event.preventDefault();
        this.moveActive(-10);
        return;

      case KEYS.enter:
        event.preventDefault();

        if (this.state.activeRecord) {
          this.selectRecord(this.state.activeRecord, { source: "keyboard" });
        }

        return;

      case KEYS.escape:
        event.preventDefault();
        this.close({ returnFocus: true });
        return;

      case KEYS.tab:
        this.close();
        return;

      default:
    }
  }

  handlePrintableKey(event) {
    if (this.searchInputElement) {
      event.preventDefault();
      this.open();

      this.searchInputElement.value += event.key;
      this.applySearch(this.searchInputElement.value, { announce: true });
      focusSafely(this.searchInputElement);
      return;
    }

    this.state.typeahead += event.key;
    this.clearTypeaheadTimer();

    this.typeaheadTimer = this.view.setTimeout(() => {
      this.state.typeahead = "";
      this.typeaheadTimer = null;
    }, this.options.typeaheadDelay);

    const query = normalizeSearchText(
      this.state.typeahead,
      this.messages.locale,
    );

    const records = this.getNavigableRecords();
    const currentIndex = records.indexOf(this.state.activeRecord);

    const orderedRecords = [
      ...records.slice(currentIndex + 1),
      ...records.slice(0, currentIndex + 1),
    ];

    const matchingRecord = orderedRecords.find((record) =>
      normalizeSearchText(
        getOptionLabel(record.nativeOption),
        this.messages.locale,
      ).startsWith(query),
    );

    if (!matchingRecord) return;

    if (!this.state.open) {
      this.open({ focusSearch: false });
    }

    this.setActiveRecord(matchingRecord, { scroll: true });
  }

  /* ==========================================================================
     Active Descendant
     ========================================================================== */

  getNavigableRecords() {
    return this.optionRecords.filter((record) =>
      this.isRecordNavigable(record),
    );
  }

  getSelectedNavigableRecord() {
    return (
      this.optionRecords.find(
        (record) =>
          record.nativeOption.selected && this.isRecordNavigable(record),
      ) || null
    );
  }

  isRecordNavigable(record) {
    if (!record || isOptionDisabled(record.nativeOption)) return false;
    if (record.nativeOption.hidden || record.element.hidden) return false;

    const group = record.element.closest(SELECTORS.group);

    return !group?.hidden;
  }

  getRecordFromEvent(event) {
    const optionElement = event.target.closest(SELECTORS.option);

    if (!optionElement || !this.listboxElement.contains(optionElement)) {
      return null;
    }

    return (
      this.optionRecords.find((record) => record.element === optionElement) ||
      null
    );
  }
  setActiveRecord(record, { scroll = true } = {}) {
    if (record && !this.isRecordNavigable(record)) return false;

    this.clearActiveRecord();
    this.state.activeRecord = record;

    if (!record) return false;

    record.element.classList.add(CLASS_NAMES.active);
    record.element.setAttribute(DATA_ATTRIBUTES.active, "true");
    this.syncActiveDescendant();

    if (scroll && typeof record.element.scrollIntoView === "function") {
      try {
        record.element.scrollIntoView({ block: "nearest" });
      } catch {
        record.element.scrollIntoView();
      }
    }

    return true;
  }

  clearActiveRecord() {
    if (this.state.activeRecord) {
      this.state.activeRecord.element.classList.remove(CLASS_NAMES.active);
      this.state.activeRecord.element.removeAttribute(DATA_ATTRIBUTES.active);
    }

    this.state.activeRecord = null;
    this.triggerElement.removeAttribute(ARIA.activeDescendant);
    this.searchInputElement?.removeAttribute(ARIA.activeDescendant);
  }

  syncActiveDescendant() {
    this.triggerElement.removeAttribute(ARIA.activeDescendant);
    this.searchInputElement?.removeAttribute(ARIA.activeDescendant);

    if (!this.state.activeRecord) return;

    const focusOwner =
      this.document.activeElement === this.searchInputElement
        ? this.searchInputElement
        : this.triggerElement;

    focusOwner.setAttribute(
      ARIA.activeDescendant,
      this.state.activeRecord.element.id,
    );
  }

  moveActive(amount) {
    const records = this.getNavigableRecords();

    if (!records.length) {
      this.setActiveRecord(null);
      return;
    }

    const currentIndex = records.indexOf(this.state.activeRecord);
    let nextIndex;

    if (currentIndex === -1) {
      nextIndex = amount < 0 ? records.length - 1 : 0;
    } else {
      nextIndex = Math.min(
        records.length - 1,
        Math.max(0, currentIndex + amount),
      );
    }

    this.setActiveRecord(records[nextIndex], { scroll: true });
  }

  moveActiveToBoundary(boundary) {
    const records = this.getNavigableRecords();
    const record =
      boundary === "end" ? records[records.length - 1] : records[0];

    this.setActiveRecord(record || null, { scroll: true });
  }

  /* ==========================================================================
     Search
     ========================================================================== */

  applySearch(query, { announce = false } = {}) {
    const rawQuery = String(query || "");
    const normalizedQuery = normalizeSearchText(rawQuery, this.messages.locale);

    this.state.query = rawQuery;
    this.component.classList.toggle(
      CLASS_NAMES.hasQuery,
      normalizedQuery.length > 0,
    );

    if (this.searchInputElement && this.searchInputElement.value !== rawQuery) {
      this.searchInputElement.value = rawQuery;
    }

    if (this.searchClearElement) {
      this.searchClearElement.hidden = normalizedQuery.length === 0;
    }

    let visibleCount = 0;

    this.optionRecords.forEach((record) => {
      const label = getOptionLabel(record.nativeOption);
      const normalizedLabel = normalizeSearchText(label, this.messages.locale);

      const matches =
        !normalizedQuery || normalizedLabel.includes(normalizedQuery);

      record.element.hidden = record.nativeOption.hidden || !matches;
      this.renderHighlightedLabel(record, rawQuery, matches);

      if (!record.element.hidden) {
        visibleCount += 1;
      }
    });

    this.listboxElement
      .querySelectorAll(SELECTORS.group)
      .forEach((groupElement) => {
        const groupRecords = this.optionRecords.filter(
          (record) => record.element.parentElement === groupElement,
        );

        const nativeGroup = groupRecords[0]?.nativeOption.parentElement;
        const groupHasVisibleOption = groupRecords.some(
          (record) => !record.element.hidden,
        );

        groupElement.hidden =
          Boolean(nativeGroup?.hidden) || !groupHasVisibleOption;
      });

    this.emptyElement.hidden = visibleCount > 0;

    if (!this.isRecordNavigable(this.state.activeRecord)) {
      this.setActiveRecord(this.getNavigableRecords()[0] || null, {
        scroll: false,
      });
    } else {
      this.syncActiveDescendant();
    }

    if (announce) {
      this.announce(this.messages.resultsStatus(visibleCount));
    }

    if (this.state.open) {
      this.positioner.schedule();
    }

    return visibleCount;
  }

  renderHighlightedLabel(record, query, matches) {
    const label = getOptionLabel(record.nativeOption);
    const trimmedQuery = String(query || "").trim();

    record.labelElement.replaceChildren();

    if (!matches || !trimmedQuery) {
      record.labelElement.textContent = label;
      return;
    }

    const expression = new RegExp(escapeRegularExpression(trimmedQuery), "giu");

    let cursor = 0;
    let match;

    while ((match = expression.exec(label)) !== null) {
      if (match.index > cursor) {
        record.labelElement.append(
          this.document.createTextNode(label.slice(cursor, match.index)),
        );
      }

      record.labelElement.append(
        createElement(
          "mark",
          {
            className: CLASS_NAMES.match,
            text: match[0],
          },
          this.document,
        ),
      );

      cursor = match.index + match[0].length;

      if (match[0].length === 0) {
        expression.lastIndex += 1;
      }
    }

    if (cursor === 0) {
      record.labelElement.textContent = label;
      return;
    }

    if (cursor < label.length) {
      record.labelElement.append(
        this.document.createTextNode(label.slice(cursor)),
      );
    }
  }

  clearSearch({ announce = false, focus = false } = {}) {
    if (!this.searchInputElement) return;

    this.searchInputElement.value = "";
    this.applySearch("", { announce });

    if (focus) {
      focusSafely(this.searchInputElement);
    }
  }

  /* ==========================================================================
     Selection
     ========================================================================== */

  selectRecord(record, { source = "api" } = {}) {
    if (
      this.state.destroyed ||
      this.isDisabled ||
      this.isLoading ||
      !record ||
      isOptionDisabled(record.nativeOption)
    ) {
      return false;
    }

    const beforeSignature = getChangeSignature(this.native);
    const wasSelected = record.nativeOption.selected;

    if (this.native.multiple) {
      record.nativeOption.selected = !wasSelected;
    } else {
      Array.from(this.native.options).forEach((option) => {
        option.selected = option === record.nativeOption;
      });
    }

    const changed = beforeSignature !== getChangeSignature(this.native);

    this.sync({ preserveActive: true });

    if (changed) {
      this.dispatchNativeEvents();
      this.syncControlState();
      this.emitChange({
        changedOption: record.nativeOption,
        selected: record.nativeOption.selected,
        source,
      });

      const message = record.nativeOption.selected
        ? this.messages.optionSelected(getOptionLabel(record.nativeOption))
        : this.messages.optionDeselected(getOptionLabel(record.nativeOption));

      this.announce(message);
    }

    if (this.native.multiple) {
      this.setActiveRecord(record, { scroll: false });
    } else {
      this.close({ returnFocus: true });
    }

    return changed;
  }

  setValue(value, { emit = true, source = "api" } = {}) {
    if (this.state.destroyed) return false;

    const beforeSignature = getChangeSignature(this.native);

    if (this.native.multiple) {
      const values = new Set(
        Array.isArray(value)
          ? value.map(String)
          : value == null || value === ""
            ? []
            : [String(value)],
      );

      Array.from(this.native.options).forEach((option) => {
        option.selected = values.has(option.value);
      });
    } else {
      const normalizedValue = value == null ? "" : String(value);

      const matchingOption = Array.from(this.native.options).find(
        (option) => option.value === normalizedValue,
      );

      Array.from(this.native.options).forEach((option) => {
        option.selected = option === matchingOption;
      });

      if (!matchingOption) {
        this.native.selectedIndex = -1;
      }
    }

    const changed = beforeSignature !== getChangeSignature(this.native);

    this.sync({ preserveActive: true });

    if (changed && emit) {
      this.dispatchNativeEvents();
      this.syncControlState();
      this.emitChange({ source });
    }

    return changed;
  }

  clear({ emit = true, source = "api" } = {}) {
    if (this.state.destroyed || this.isDisabled || this.isLoading) return false;

    const beforeSignature = getChangeSignature(this.native);

    if (this.native.multiple) {
      Array.from(this.native.options).forEach((option) => {
        option.selected = false;
      });
    } else {
      const emptyOption = Array.from(this.native.options).find(
        (option) => option.value === "" && !option.disabled && !option.hidden,
      );

      Array.from(this.native.options).forEach((option) => {
        option.selected = option === emptyOption;
      });

      if (!emptyOption) {
        this.native.selectedIndex = -1;
      }
    }

    const changed = beforeSignature !== getChangeSignature(this.native);

    this.sync({ preserveActive: false });

    if (changed && emit) {
      this.dispatchNativeEvents();
      this.syncControlState();
      this.emitChange({ source });
      this.announce(this.messages.selectionCleared);
    }

    return changed;
  }

  dispatchNativeEvents() {
    const EventConstructor = this.view.Event;

    this.state.dispatchingNativeEvents = true;

    try {
      this.native.dispatchEvent(
        new EventConstructor(DOM_EVENTS.input, { bubbles: true }),
      );

      this.native.dispatchEvent(
        new EventConstructor(DOM_EVENTS.change, { bubbles: true }),
      );
    } finally {
      this.state.dispatchingNativeEvents = false;
    }
  }

  emitChange({ changedOption = null, selected = null, source = "api" } = {}) {
    const selectedOptions = this.selectedOptions;
    const values = selectedOptions.map((option) => option.value);
    const labels = selectedOptions.map((option) => getOptionLabel(option));
    const value = this.native.multiple ? values : this.native.value;

    const detail = {
      value,
      values,
      label: this.native.multiple ? labels : labels[0] || "",
      labels,
      multiple: this.native.multiple,
      native: this.native,
      changedOption,
      selected,
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
     Rendering and Synchronization
     ========================================================================== */

  sync({ preserveActive = true } = {}) {
    if (this.state.destroyed) return;

    const activeOption = preserveActive
      ? this.state.activeRecord?.nativeOption
      : null;

    if (!preserveActive) {
      this.clearActiveRecord();
    }

    this.syncControlState();
    this.syncOptionStates();
    this.renderValue();

    if (activeOption) {
      const activeRecord = this.optionRecords.find(
        (record) => record.nativeOption === activeOption,
      );

      if (this.isRecordNavigable(activeRecord)) {
        this.setActiveRecord(activeRecord, { scroll: false });
      } else {
        this.setActiveRecord(null);
      }
    }

    this.syncMultipleSummary();
  }

  syncControlState() {
    const disabled = this.isDisabled;
    const invalid = this.native.getAttribute(ARIA.invalid);
    const describedBy = this.native.getAttribute(ARIA.describedBy);

    const busy =
      this.component.classList.contains(CLASS_NAMES.loading) ||
      this.component.getAttribute(ARIA.busy) === "true";

    this.triggerElement.disabled = disabled;
    this.triggerElement.setAttribute(ARIA.disabled, String(disabled));

    if (invalid && invalid !== "false") {
      this.triggerElement.setAttribute(ARIA.invalid, invalid);
    } else {
      this.triggerElement.removeAttribute(ARIA.invalid);
    }

    restoreAttribute(
      this.triggerElement,
      ARIA.describedBy,
      describedBy?.trim() || null,
    );

    restoreAttribute(
      this.triggerElement,
      "aria-required",
      this.native.required ? "true" : null,
    );

    restoreAttribute(this.triggerElement, ARIA.busy, busy ? "true" : null);

    if (this.clearElement) {
      this.clearElement.disabled = disabled;
    }

    if (disabled && this.state.open) {
      this.close({ immediate: true });
    }
  }

  syncOptionStates() {
    this.optionRecords.forEach((record) => {
      const selected = record.nativeOption.selected;
      const disabled = isOptionDisabled(record.nativeOption);

      record.element.classList.toggle(CLASS_NAMES.selected, selected);
      record.element.classList.toggle(CLASS_NAMES.disabled, disabled);
      record.element.setAttribute(ARIA.selected, String(selected));

      restoreAttribute(record.element, ARIA.disabled, disabled ? "true" : null);
    });

    restoreAttribute(
      this.listboxElement,
      ARIA.multiSelectable,
      this.native.multiple ? "true" : null,
    );

    this.component.classList.toggle(CLASS_NAMES.multiple, this.native.multiple);
  }

  renderValue() {
    const selectedOptions = this.selectedOptions;

    this.valueElement.replaceChildren();

    if (this.native.multiple) {
      this.renderMultipleValue(selectedOptions);
    } else {
      this.renderSingleValue(selectedOptions[0] || null);
    }

    const hasValue = this.native.multiple
      ? selectedOptions.length > 0
      : Boolean(selectedOptions[0] && selectedOptions[0].value !== "");

    this.component.classList.toggle(CLASS_NAMES.hasValue, hasValue);

    if (this.clearElement) {
      this.clearElement.hidden = !hasValue;
    }
  }

  renderSingleValue(selectedOption) {
    const placeholder = this.getPlaceholder();
    const isPlaceholder = optionIsPlaceholder(selectedOption);

    this.valueElement.textContent = isPlaceholder
      ? placeholder
      : getOptionLabel(selectedOption);

    this.valueElement.classList.toggle(CLASS_NAMES.placeholder, isPlaceholder);
    this.valueElement.dataset.placeholder = String(isPlaceholder);
  }

  renderMultipleValue(selectedOptions) {
    if (!selectedOptions.length) {
      this.valueElement.textContent = this.getPlaceholder();
      this.valueElement.classList.add(CLASS_NAMES.placeholder);
      this.valueElement.dataset.placeholder = "true";
      return;
    }

    this.valueElement.classList.remove(CLASS_NAMES.placeholder);
    this.valueElement.dataset.placeholder = "false";

    const tagsElement = createElement(
      "span",
      {
        className: CLASS_NAMES.tags,
      },
      this.document,
    );

    selectedOptions.forEach((option) => {
      const tagElement = createElement(
        "span",
        {
          className: CLASS_NAMES.tag,
        },
        this.document,
      );

      const labelElement = createElement(
        "span",
        {
          className: CLASS_NAMES.tagLabel,
          attributes: {
            dir: "auto",
          },
          text: getOptionLabel(option),
        },
        this.document,
      );

      tagElement.append(labelElement);
      tagsElement.append(tagElement);
    });

    const countElement = createElement(
      "span",
      {
        className: CLASS_NAMES.selectionCount,
        attributes: {
          hidden: true,
        },
        text: this.messages.selectedCount(selectedOptions.length),
      },
      this.document,
    );

    this.valueElement.append(tagsElement, countElement);
  }

  syncMultipleSummary() {
    if (!this.native.multiple) {
      this.component.classList.remove(CLASS_NAMES.hasSelectionCount);
      return;
    }

    const selectedCount = this.selectedOptions.length;
    const compact = this.view.innerWidth < 576 && selectedCount > 2;

    const tagsElement = this.valueElement.querySelector(`.${CLASS_NAMES.tags}`);

    const countElement = this.valueElement.querySelector(
      `.${CLASS_NAMES.selectionCount}`,
    );

    this.component.classList.toggle(CLASS_NAMES.hasSelectionCount, compact);

    if (tagsElement) {
      restoreAttribute(tagsElement, ARIA.hidden, compact ? "true" : null);
    }

    if (countElement) {
      countElement.hidden = !compact;
      countElement.textContent = this.messages.selectedCount(selectedCount);
    }
  }

  getPlaceholder() {
    const explicitPlaceholder = this.component
      .getAttribute(DATA_ATTRIBUTES.placeholder)
      ?.trim();

    if (explicitPlaceholder) return explicitPlaceholder;

    const placeholderOption = Array.from(this.native.options).find(
      (option) =>
        option.value === "" &&
        (option.disabled ||
          option.hidden ||
          option.dataset.placeholder === "true"),
    );

    if (placeholderOption) {
      return getOptionLabel(placeholderOption);
    }

    return "—";
  }

  refreshMessages() {
    this.messages = getCustomSelectMessages(this.component);

    if (this.searchInputElement) {
      this.searchInputElement.placeholder = this.messages.searchPlaceholder;

      this.searchInputElement.setAttribute(
        ARIA.label,
        this.messages.searchPlaceholder,
      );
    }

    if (this.searchClearElement) {
      this.searchClearElement.setAttribute(
        ARIA.label,
        this.messages.clearSearch,
      );
    }

    if (this.clearElement) {
      this.clearElement.setAttribute(ARIA.label, this.messages.clearSelection);
    }

    this.emptyElement.textContent = this.messages.noResults;
  }

  announce(message) {
    if (!message || this.state.destroyed) return;

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
     Public Lifecycle
     ========================================================================== */

  refresh() {
    if (this.state.destroyed) return this;

    const activeNativeOption = this.state.activeRecord?.nativeOption || null;

    this.refreshMessages();
    this.clearActiveRecord();

    this.optionRecords = renderCustomSelectOptions({
      native: this.native,
      listbox: this.listboxElement,
      idPrefix: `${this.native.id}-custom-select`,
    });

    this.applySearch(this.state.query, { announce: false });
    this.sync({ preserveActive: false });

    const refreshedActiveRecord = this.optionRecords.find(
      (record) => record.nativeOption === activeNativeOption,
    );

    if (this.isRecordNavigable(refreshedActiveRecord)) {
      this.setActiveRecord(refreshedActiveRecord, { scroll: false });
    } else if (this.state.open) {
      this.setActiveRecord(
        this.getSelectedNavigableRecord() ||
          this.getNavigableRecords()[0] ||
          null,
        { scroll: false },
      );
    }

    if (this.state.open) {
      this.positioner.schedule();
    }

    return this;
  }

  setLoading(isLoading = true) {
    const loading = Boolean(isLoading);

    this.component.classList.toggle(CLASS_NAMES.loading, loading);
    restoreAttribute(this.component, ARIA.busy, loading ? "true" : null);
    this.syncControlState();

    if (loading && this.state.open) {
      this.close({ immediate: true });
    }

    if (loading) {
      this.announce(this.messages.loading);
    }

    return this;
  }

  destroy() {
    if (this.state.destroyed) return;

    const activeElementWasInside = this.interfaceElement.contains(
      this.document.activeElement,
    );

    this.close({ immediate: true, emit: false });
    this.state.destroyed = true;

    this.abortController.abort();
    this.mutationObserver?.disconnect();
    this.positioner.destroy();

    this.clearCloseTimer();
    this.clearAnnouncementTimer();
    this.clearScheduledReset();
    this.clearTypeaheadTimer();

    this.interfaceElement.remove();

    restoreAttribute(this.native, "tabindex", this.original.nativeTabIndex);
    restoreAttribute(this.native, "id", this.original.nativeId);

    if (this.original.labelElement) {
      restoreAttribute(this.original.labelElement, "id", this.original.labelId);
    }

    this.component.classList.remove(
      CLASS_NAMES.enhanced,
      CLASS_NAMES.enhancementFailed,
      CLASS_NAMES.open,
      CLASS_NAMES.openUp,
      CLASS_NAMES.closing,
      CLASS_NAMES.nativeFocused,
      CLASS_NAMES.hasValue,
      CLASS_NAMES.hasQuery,
      CLASS_NAMES.hasSelectionCount,
    );

    this.component.classList.toggle(
      CLASS_NAMES.multiple,
      this.original.componentMultipleClass,
    );

    if (activeInstance === this) {
      activeInstance = null;
    }

    instances.delete(this.component);

    if (activeElementWasInside) {
      focusSafely(this.native);
    }
  }

  /* ==========================================================================
     Timer Cleanup
     ========================================================================== */

  clearCloseTimer() {
    if (this.closeTimer === null) return;

    this.view.clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  clearAnnouncementTimer() {
    if (this.announcementTimer === null) return;

    this.view.clearTimeout(this.announcementTimer);
    this.announcementTimer = null;
  }

  clearScheduledReset() {
    if (this.resetTimer === null) return;

    this.view.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  clearTypeaheadTimer() {
    if (this.typeaheadTimer === null) return;

    this.view.clearTimeout(this.typeaheadTimer);
    this.typeaheadTimer = null;
    this.state.typeahead = "";
  }
}
