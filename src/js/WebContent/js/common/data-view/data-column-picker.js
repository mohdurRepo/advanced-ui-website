/* ==========================================================================
   Data Column Picker
   ========================================================================== */

/*
 * Generic DOM adapter for column-group visibility controls.
 *
 * Responsibilities:
 *
 * - bind column-group controls
 * - synchronize selected / disabled / hidden state
 * - support Select All / Clear All
 * - update selected-count label
 * - manage picker open / close behavior
 * - connect DOM controls to createDataColumnVisibility()
 *
 * This module intentionally has no:
 *
 * - DataTables code
 * - page-specific data attributes
 * - page-specific group names
 * - AJAX code
 * - business logic
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveElement(root, value) {
  if (value instanceof Element) {
    return value;
  }

  if (typeof value === "string") {
    return root.querySelector(value);
  }

  return null;
}

function resolveElements(root, value) {
  if (!value) {
    return [];
  }

  if (value instanceof Element) {
    return [value];
  }

  if (
    value instanceof NodeList ||
    value instanceof HTMLCollection ||
    Array.isArray(value)
  ) {
    return Array.from(value).filter((item) => item instanceof Element);
  }

  if (typeof value === "string") {
    return Array.from(root.querySelectorAll(value));
  }

  return [];
}

/* ==========================================================================
   Group Resolution
   ========================================================================== */

function getGroupId(input, options) {
  if (typeof options.getGroupId === "function") {
    return String(options.getGroupId(input) || "");
  }

  return String(
    input.dataset.columnGroup ||
      input.dataset.dataColumnGroup ||
      input.value ||
      "",
  );
}

/* ==========================================================================
   Action Resolution
   ========================================================================== */

function getActionType(element, options) {
  if (typeof options.getActionType === "function") {
    return String(options.getActionType(element) || "");
  }

  return String(
    element.dataset.columnAction || element.dataset.dataColumnAction || "",
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataColumnPicker(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataColumnPicker requires an options object.");
  }

  const root = options.root || document;

  const visibility = options.visibility;

  if (
    !visibility ||
    typeof visibility.getState !== "function" ||
    typeof visibility.setVisibleGroups !== "function"
  ) {
    throw new TypeError(
      "Data column picker requires a column visibility instance.",
    );
  }

  const trigger = resolveElement(root, options.trigger);

  const menu = resolveElement(root, options.menu);

  const label = resolveElement(root, options.label);

  const abortController = new AbortController();

  let destroyed = false;
  let open = false;
  let unsubscribe = null;

  /* ========================================================================
     Elements
     ======================================================================== */

  function getInputs() {
    return resolveElements(root, options.inputs);
  }

  /* ========================================================================
     Label
     ======================================================================== */

  function updateLabel() {
    if (!label) {
      return;
    }

    const state = visibility.getState();

    const labels = options.labels || {};

    /* ----------------------------------------------------------------------
       All
       ---------------------------------------------------------------------- */

    if (state.availableCount === 0 || state.allSelected) {
      label.textContent = labels.all || "Show All";

      return;
    }

    /* ----------------------------------------------------------------------
       None
       ---------------------------------------------------------------------- */

    if (state.noneSelected) {
      label.textContent = labels.none || "No Columns";

      return;
    }

    /* ----------------------------------------------------------------------
       Partial Selection
       ---------------------------------------------------------------------- */

    label.textContent =
      typeof labels.selected === "function"
        ? labels.selected(state.selectedCount, state)
        : `${state.selectedCount} ${labels.selectedSuffix || "Selected"}`;
  }

  /* ========================================================================
     Option Resolution
     ======================================================================== */

  function getOptionElement(input) {
    if (typeof options.getOptionElement === "function") {
      return options.getOptionElement(input) || null;
    }

    return input.closest(
      options.optionSelector ||
        "[data-column-option], .filter-bar__columns-option, .form-select-option",
    );
  }

  /* ========================================================================
     Synchronization
     ======================================================================== */

  function syncInputs() {
    if (destroyed) {
      return;
    }

    const state = visibility.getState();

    const available = new Set(state.availableGroups);

    const visible = new Set(state.visibleGroups);

    getInputs().forEach((input) => {
      const groupId = getGroupId(input, options);

      const isAvailable = Boolean(groupId) && available.has(groupId);

      if ("disabled" in input) {
        input.disabled = !isAvailable;
      }

      if ("checked" in input) {
        input.checked = isAvailable && visible.has(groupId);
      }

      const option = getOptionElement(input);

      if (option) {
        option.hidden = !isAvailable;
      }
    });

    updateLabel();

    options.afterSync?.(state);
  }

  /* ========================================================================
     Menu State
     ======================================================================== */

  function openMenu() {
    if (destroyed || !menu || open) {
      return;
    }

    open = true;

    menu.hidden = false;

    trigger?.setAttribute("aria-expanded", "true");

    options.onOpen?.();

    window.requestAnimationFrame(() => {
      if (destroyed || !open) {
        return;
      }

      getInputs()
        .find((input) => !input.disabled && !getOptionElement(input)?.hidden)
        ?.focus();
    });
  }

  function closeMenu(settings = {}) {
    if (destroyed || !menu || !open) {
      return;
    }

    open = false;

    menu.hidden = true;

    trigger?.setAttribute("aria-expanded", "false");

    if (settings.restoreFocus) {
      trigger?.focus();
    }

    options.onClose?.();
  }

  function toggleMenu() {
    if (destroyed) {
      return;
    }

    if (open) {
      closeMenu();

      return;
    }

    openMenu();
  }

  /* ========================================================================
     Input Changes
     ======================================================================== */

  function handleChange(event) {
    if (destroyed || !(event.target instanceof Element)) {
      return;
    }

    const input = event.target.closest(
      options.inputSelector || "[data-column-group], [data-data-column-group]",
    );

    if (!input || input.disabled) {
      return;
    }

    const groupId = getGroupId(input, options);

    if (!groupId) {
      return;
    }

    if (input.checked) {
      visibility.showGroup(groupId, {
        source: event,
      });

      return;
    }

    visibility.hideGroup(groupId, {
      source: event,
    });
  }

  /* ========================================================================
     Actions
     ======================================================================== */

  function handleAction(event) {
    if (destroyed || !(event.target instanceof Element)) {
      return;
    }

    const action = event.target.closest(
      options.actionSelector ||
        "[data-column-action], [data-data-column-action]",
    );

    if (!action) {
      return;
    }

    const type = getActionType(action, options);

    if (!type) {
      return;
    }

    event.preventDefault();

    switch (type) {
      case "select-all":
        visibility.selectAll({
          source: event,
        });

        break;

      case "clear-all":
        visibility.clearAll({
          source: event,
        });

        break;

      default:
        options.onAction?.(type, action, event);
    }
  }

  /* ========================================================================
     Trigger
     ======================================================================== */

  function handleTriggerClick(event) {
    event.preventDefault();

    toggleMenu();
  }

  /* ========================================================================
     Outside Interaction
     ======================================================================== */

  function handleDocumentPointerDown(event) {
    if (!open || !(event.target instanceof Node)) {
      return;
    }

    const clickedTrigger = trigger?.contains(event.target);

    const clickedMenu = menu?.contains(event.target);

    if (!clickedTrigger && !clickedMenu) {
      closeMenu();
    }
  }

  function handleDocumentKeyDown(event) {
    if (!open || event.key !== "Escape") {
      return;
    }

    event.preventDefault();

    closeMenu({
      restoreFocus: true,
    });
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  function refresh() {
    if (destroyed) {
      return;
    }

    syncInputs();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    unsubscribe?.();
    unsubscribe = null;

    abortController.abort();
  }

  /* ========================================================================
     Event Registration
     ======================================================================== */

  const eventOptions = {
    signal: abortController.signal,
  };

  trigger?.addEventListener("click", handleTriggerClick, eventOptions);

  menu?.addEventListener("change", handleChange, eventOptions);

  menu?.addEventListener("click", handleAction, eventOptions);

  document.addEventListener(
    "pointerdown",
    handleDocumentPointerDown,
    eventOptions,
  );

  document.addEventListener("keydown", handleDocumentKeyDown, eventOptions);

  unsubscribe = visibility.subscribe(syncInputs);

  /* ========================================================================
     Initialization
     ======================================================================== */

  if (menu) {
    open = !menu.hidden;

    trigger?.setAttribute("aria-expanded", String(open));
  }

  syncInputs();

  /* ========================================================================
     Public API
     ======================================================================== */

  return Object.freeze({
    close: closeMenu,

    destroy,

    open: openMenu,

    refresh,

    toggle: toggleMenu,
  });
}
