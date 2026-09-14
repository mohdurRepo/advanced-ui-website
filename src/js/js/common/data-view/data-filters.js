/* ==========================================================================
   Data Filters
   ========================================================================== */

/*
 * Generic filter-controller for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - bind filter controls
 * - read values from the DOM
 * - normalize values
 * - maintain filter state
 * - synchronize state back to controls
 * - emit meaningful filter-change events
 * - support reset
 * - support custom readers / writers / validation hooks
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - DataTables code
 * - card rendering
 * - column visibility implementation
 * - page-specific business logic
 * - responsive breakpoint logic
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }

  return value;
}

function areEqual(first, second) {
  if (Object.is(first, second)) {
    return true;
  }

  if (typeof first !== typeof second || first === null || second === null) {
    return false;
  }

  if (typeof first !== "object") {
    return false;
  }

  if (Array.isArray(first) !== Array.isArray(second)) {
    return false;
  }

  if (Array.isArray(first)) {
    return (
      first.length === second.length &&
      first.every((value, index) => areEqual(value, second[index]))
    );
  }

  const firstKeys = Object.keys(first);

  const secondKeys = Object.keys(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  return firstKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(second, key) &&
      areEqual(first[key], second[key]),
  );
}

function freezeSnapshot(value) {
  const cloned = cloneValue(value);

  function freeze(item) {
    if (item === null || typeof item !== "object" || Object.isFrozen(item)) {
      return item;
    }

    Object.values(item).forEach(freeze);

    return Object.freeze(item);
  }

  return freeze(cloned);
}

function resolveElements(root, selector) {
  if (!selector) {
    return [];
  }

  if (selector instanceof Element) {
    return [selector];
  }

  if (
    selector instanceof NodeList ||
    selector instanceof HTMLCollection ||
    Array.isArray(selector)
  ) {
    return Array.from(selector).filter((item) => item instanceof Element);
  }

  if (typeof selector === "string") {
    return Array.from(root.querySelectorAll(selector));
  }

  return [];
}

function getDefaultEvent(element) {
  if (element instanceof HTMLInputElement) {
    if (
      element.type === "text" ||
      element.type === "search" ||
      element.type === "number"
    ) {
      return "input";
    }
  }

  return "change";
}

/* ==========================================================================
   Default Value Reading
   ========================================================================== */

function readSingleElement(element) {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") {
      return element.checked;
    }

    if (element.type === "radio") {
      return element.checked ? element.value : undefined;
    }

    return element.value;
  }

  if (
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.value;
  }

  return element.dataset.value ?? "";
}

function readDefault(elements) {
  if (!elements.length) {
    return undefined;
  }

  /* ------------------------------------------------------------------------
     Radio Group
     ------------------------------------------------------------------------ */

  const radios = elements.filter(
    (element) =>
      element instanceof HTMLInputElement && element.type === "radio",
  );

  if (radios.length === elements.length) {
    return radios.find((radio) => radio.checked)?.value;
  }

  /* ------------------------------------------------------------------------
     Checkbox Group
     ------------------------------------------------------------------------ */

  const checkboxes = elements.filter(
    (element) =>
      element instanceof HTMLInputElement && element.type === "checkbox",
  );

  if (checkboxes.length > 1 && checkboxes.length === elements.length) {
    return checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  }

  return readSingleElement(elements[0]);
}

/* ==========================================================================
   Default Value Writing
   ========================================================================== */

function writeDefault(elements, value) {
  if (!elements.length) {
    return;
  }

  const radios = elements.filter(
    (element) =>
      element instanceof HTMLInputElement && element.type === "radio",
  );

  if (radios.length === elements.length) {
    radios.forEach((radio) => {
      radio.checked = String(radio.value) === String(value ?? "");
    });

    return;
  }

  const checkboxes = elements.filter(
    (element) =>
      element instanceof HTMLInputElement && element.type === "checkbox",
  );

  if (checkboxes.length > 1 && checkboxes.length === elements.length) {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = selected.has(String(checkbox.value));
    });

    return;
  }

  const element = elements[0];

  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value);

    return;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.value = value == null ? "" : String(value);

    return;
  }

  element.dataset.value = value == null ? "" : String(value);
}

/* ==========================================================================
   Field Normalization
   ========================================================================== */

function normalizeField(key, definition) {
  if (typeof definition === "string") {
    return {
      key,
      selector: definition,
    };
  }

  if (!isObject(definition)) {
    throw new TypeError(
      `Data filter "${key}" requires a selector or configuration object.`,
    );
  }

  return {
    key,
    ...definition,
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataFilters requires an options object.");
  }

  const root = options.root || document;

  const fieldDefinitions = options.fields || {};

  if (!isObject(fieldDefinitions)) {
    throw new TypeError("Data filters fields must be an object.");
  }

  const fields = new Map();

  const listeners = new Set();

  const abortController = new AbortController();

  let destroyed = false;

  /* ========================================================================
     Field Setup
     ======================================================================== */

  Object.entries(fieldDefinitions).forEach(([key, definition]) => {
    const field = normalizeField(key, definition);

    const elements = resolveElements(root, field.selector);

    if (!elements.length && field.required) {
      throw new Error(`Required data filter "${key}" was not found.`);
    }

    fields.set(key, {
      ...field,
      elements,
    });
  });

  /* ========================================================================
     Reading
     ======================================================================== */

  function readField(field) {
    let value;

    if (typeof field.read === "function") {
      value = field.read({
        elements: field.elements,

        root,

        key: field.key,
      });
    } else {
      value = readDefault(field.elements);
    }

    if (typeof field.normalize === "function") {
      value = field.normalize(value, {
        elements: field.elements,

        root,

        key: field.key,
      });
    }

    return value;
  }

  function getState() {
    const state = {};

    fields.forEach((field, key) => {
      state[key] = readField(field);
    });

    return freezeSnapshot(state);
  }

  function getValue(key) {
    const field = fields.get(key);

    if (!field) {
      return undefined;
    }

    return cloneValue(readField(field));
  }

  /* ========================================================================
     Writing
     ======================================================================== */

  function writeField(field, value) {
    if (typeof field.write === "function") {
      field.write(value, {
        elements: field.elements,

        root,

        key: field.key,
      });

      return;
    }

    writeDefault(field.elements, value);
  }

  function setValue(key, value, settings = {}) {
    if (destroyed) {
      return false;
    }

    const field = fields.get(key);

    if (!field) {
      return false;
    }

    const previousValue = readField(field);

    let nextValue = value;

    if (typeof field.normalize === "function") {
      nextValue = field.normalize(nextValue, {
        elements: field.elements,

        root,

        key: field.key,
      });
    }

    if (areEqual(previousValue, nextValue)) {
      return false;
    }

    writeField(field, nextValue);

    if (settings.notify !== false) {
      notify({
        type: settings.type || field.type || key,

        key,

        value: cloneValue(nextValue),

        previousValue: cloneValue(previousValue),

        effect: field.effect || null,

        source: settings.source || null,
      });
    }

    return true;
  }

  function setState(nextState = {}, settings = {}) {
    if (destroyed || !isObject(nextState)) {
      return false;
    }

    let changed = false;

    Object.entries(nextState).forEach(([key, value]) => {
      const field = fields.get(key);

      if (!field) {
        return;
      }

      const previousValue = readField(field);

      let nextValue = value;

      if (typeof field.normalize === "function") {
        nextValue = field.normalize(nextValue, {
          elements: field.elements,

          root,

          key: field.key,
        });
      }

      if (areEqual(previousValue, nextValue)) {
        return;
      }

      writeField(field, nextValue);

      changed = true;
    });

    if (changed && settings.notify !== false) {
      notify({
        type: settings.type || "state",

        key: null,

        value: null,
        previousValue: null,

        effect: settings.effect || null,

        source: settings.source || null,
      });
    }

    return changed;
  }

  /* ========================================================================
     Notification
     ======================================================================== */

  function notify(change) {
    if (destroyed) {
      return;
    }

    const event = Object.freeze({
      ...change,

      state: getState(),
    });

    listeners.forEach((listener) => {
      listener(event);
    });

    if (options.eventTarget instanceof EventTarget) {
      options.eventTarget.dispatchEvent(
        new CustomEvent(options.eventName || "datafilters:change", {
          detail: event,
        }),
      );
    }
  }

  /* ========================================================================
     DOM Changes
     ======================================================================== */

  function handleFieldChange(field, sourceEvent) {
    if (destroyed) {
      return;
    }

    const previousValue = field.lastValue;

    const nextValue = readField(field);

    /*
     * Optional page-level guard.
     *
     * Useful for things such as:
     *
     * - authentication requirements
     * - invalid date ranges
     * - dependent filter restrictions
     *
     * Returning false rejects the change and restores the previous value.
     */

    if (typeof field.beforeChange === "function") {
      const allowed = field.beforeChange({
        key: field.key,

        value: cloneValue(nextValue),

        previousValue: cloneValue(previousValue),

        state: getState(),

        event: sourceEvent,

        elements: field.elements,
      });

      if (allowed === false) {
        writeField(field, previousValue);

        return;
      }
    }

    if (areEqual(previousValue, nextValue)) {
      return;
    }

    field.lastValue = cloneValue(nextValue);

    notify({
      type: field.type || field.key,

      key: field.key,

      value: cloneValue(nextValue),

      previousValue: cloneValue(previousValue),

      /*
       * `effect` is descriptive only.
       *
       * The future controller decides what to do with it.
       */

      effect: field.effect || null,

      source: sourceEvent,
    });
  }

  /* ========================================================================
     Event Registration
     ======================================================================== */

  function bindField(field) {
    if (!field.elements.length) {
      return;
    }

    field.lastValue = cloneValue(readField(field));

    const configuredEvents = field.events || field.event;

    const events = configuredEvents
      ? Array.isArray(configuredEvents)
        ? configuredEvents
        : [configuredEvents]
      : [getDefaultEvent(field.elements[0])];

    field.elements.forEach((element) => {
      events.forEach((eventName) => {
        element.addEventListener(
          eventName,
          (event) => {
            handleFieldChange(field, event);
          },
          {
            signal: abortController.signal,
          },
        );
      });
    });
  }

  fields.forEach(bindField);

  /* ========================================================================
     Synchronization
     ======================================================================== */

  function refresh() {
    if (destroyed) {
      return;
    }

    fields.forEach((field) => {
      field.elements = resolveElements(root, field.selector);

      field.lastValue = cloneValue(readField(field));
    });
  }

  function sync() {
    if (destroyed) {
      return;
    }

    fields.forEach((field) => {
      field.lastValue = cloneValue(readField(field));
    });
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  const initialState = getState();

  function reset(settings = {}) {
    if (destroyed) {
      return false;
    }

    const previousState = getState();

    let changed = false;

    fields.forEach((field, key) => {
      const resetValue =
        field.resetValue !== undefined
          ? cloneValue(field.resetValue)
          : cloneValue(initialState[key]);

      const currentValue = readField(field);

      if (areEqual(currentValue, resetValue)) {
        return;
      }

      writeField(field, resetValue);

      field.lastValue = cloneValue(resetValue);

      changed = true;
    });

    if (changed && settings.notify !== false) {
      notify({
        type: settings.type || "reset",

        key: null,

        value: null,

        previousValue: previousState,

        effect: settings.effect || "reload",

        source: settings.source || null,
      });
    }

    return changed;
  }

  /* ========================================================================
     Enable / Disable
     ======================================================================== */

  function setDisabled(key, disabled = true) {
    const field = fields.get(key);

    if (!field) {
      return false;
    }

    field.elements.forEach((element) => {
      if ("disabled" in element) {
        element.disabled = Boolean(disabled);
      }
    });

    return true;
  }

  /* ========================================================================
     Subscription
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Data filter listener must be a function.");
    }

    if (destroyed) {
      return () => {};
    }

    listeners.add(listener);

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortController.abort();

    listeners.clear();
    fields.clear();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    getState,
    getValue,

    refresh,
    reset,

    setDisabled,
    setState,
    setValue,

    subscribe,
    sync,
  });
}
