/* ==========================================================================
   Data View State
   ========================================================================== */

/*
 * Small observable state container used by reusable data-view modules.
 *
 * Responsibilities:
 *
 * - store state
 * - expose immutable snapshots
 * - update state predictably
 * - avoid duplicate notifications
 * - allow subscriptions
 * - support destruction
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables code
 * - AJAX code
 * - page-specific business logic
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

function freezeValue(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);

  return Object.freeze(value);
}

function createSnapshot(state) {
  return freezeValue(cloneValue(state));
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
    if (first.length !== second.length) {
      return false;
    }

    return first.every((value, index) => areEqual(value, second[index]));
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

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataState(initialState = {}) {
  if (!isObject(initialState)) {
    throw new TypeError("createDataState requires an object as initial state.");
  }

  let state = cloneValue(initialState);

  let destroyed = false;

  const listeners = new Set();

  /* ========================================================================
     Snapshot
     ======================================================================== */

  function getState() {
    return createSnapshot(state);
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
  }

  /* ========================================================================
     Replace State
     ======================================================================== */

  function replace(nextState, options = {}) {
    if (destroyed) {
      return false;
    }

    if (!isObject(nextState)) {
      throw new TypeError("Data state replacement must be an object.");
    }

    const normalized = cloneValue(nextState);

    if (areEqual(normalized, state)) {
      return false;
    }

    const previousState = getState();

    state = normalized;

    if (options.notify !== false) {
      notify({
        type: options.type || "replace",

        previousState,

        source: options.source || null,
      });
    }

    return true;
  }

  /* ========================================================================
     Merge State
     ======================================================================== */

  function setState(partialState, options = {}) {
    if (destroyed) {
      return false;
    }

    if (typeof partialState === "function") {
      partialState = partialState(getState());
    }

    if (!isObject(partialState)) {
      throw new TypeError(
        "Data state update must be an object or updater function.",
      );
    }

    const nextState = {
      ...state,
      ...cloneValue(partialState),
    };

    if (areEqual(nextState, state)) {
      return false;
    }

    const previousState = getState();

    state = nextState;

    if (options.notify !== false) {
      notify({
        type: options.type || "update",

        previousState,

        changes: createSnapshot(partialState),

        source: options.source || null,
      });
    }

    return true;
  }

  /* ========================================================================
     Single Value
     ======================================================================== */

  function set(key, value, options = {}) {
    if (typeof key !== "string" || !key) {
      throw new TypeError("Data state key must be a non-empty string.");
    }

    return setState(
      {
        [key]: value,
      },
      options,
    );
  }

  function get(key) {
    if (typeof key !== "string" || !key) {
      return undefined;
    }

    return cloneValue(state[key]);
  }

  /* ========================================================================
     Subscription
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Data state listener must be a function.");
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
     Reset
     ======================================================================== */

  const originalState = cloneValue(initialState);

  function reset(options = {}) {
    return replace(originalState, {
      type: options.type || "reset",

      source: options.source || null,

      notify: options.notify,
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    listeners.clear();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    get,
    getState,

    replace,
    reset,

    set,
    setState,

    subscribe,
  });
}
