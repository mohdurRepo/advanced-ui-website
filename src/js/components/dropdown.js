const SELECTORS = {
  root: "[data-dropdown]",
  trigger: "[data-dropdown-trigger]",
  menu: "[data-dropdown-menu]",
  item: [
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
  ].join(", "),
};

const CLASSES = {
  open: "is-open",
};

const initializedDropdowns = new WeakSet();

let activeDropdown = null;
let dropdownId = 0;
let globalListenersBound = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Returns the event target when it is an Element.
 *
 * Delegated event handlers must not assume EventTarget implements closest().
 */

const getEventElement = (event) =>
  event.target instanceof Element ? event.target : null;

/**
 * Returns the trigger and menu owned by a dropdown root.
 *
 * Elements belonging to nested dropdown roots are excluded.
 *
 * @param {HTMLElement} root
 * @returns {{
 *   trigger: HTMLElement,
 *   menu: HTMLElement
 * } | null}
 */

const getDropdownParts = (root) => {
  const trigger = Array.from(root.querySelectorAll(SELECTORS.trigger)).find(
    (element) => element.closest(SELECTORS.root) === root,
  );

  const menu = Array.from(root.querySelectorAll(SELECTORS.menu)).find(
    (element) => element.closest(SELECTORS.root) === root,
  );

  if (!(trigger instanceof HTMLElement)) {
    return null;
  }

  if (!(menu instanceof HTMLElement)) {
    return null;
  }

  return {
    trigger,
    menu,
  };
};

/**
 * Returns enabled menu items owned by one dropdown.
 *
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */

const getMenuItems = (root) => {
  const parts = getDropdownParts(root);

  if (!parts) {
    return [];
  }

  return Array.from(parts.menu.querySelectorAll(SELECTORS.item)).filter(
    (item) => {
      const ownsItem = item.closest(SELECTORS.root) === root;

      const isDisabled =
        item.matches(":disabled") ||
        item.classList.contains("is-disabled") ||
        item.getAttribute("aria-disabled") === "true";

      return ownsItem && !isDisabled;
    },
  );
};

/**
 * Checks whether a trigger or menu item is disabled.
 *
 * @param {HTMLElement} element
 * @returns {boolean}
 */

const isDisabled = (element) =>
  element.matches(":disabled") ||
  element.classList.contains("is-disabled") ||
  element.getAttribute("aria-disabled") === "true";

/**
 * Checks whether a dropdown is open.
 *
 * @param {HTMLElement} root
 * @returns {boolean}
 */

const isDropdownOpen = (root) => {
  const parts = getDropdownParts(root);

  if (!parts) {
    return false;
  }

  return (
    parts.trigger.getAttribute("aria-expanded") === "true" && !parts.menu.hidden
  );
};

/* ==========================================================================
   IDs
   ========================================================================== */

const createUniqueId = (prefix) => {
  let id;

  do {
    dropdownId += 1;
    id = `${prefix}-${dropdownId}`;
  } while (document.getElementById(id));

  return id;
};

/* ==========================================================================
   State
   ========================================================================== */

/**
 * Closes one dropdown.
 *
 * @param {HTMLElement} root
 * @param {{
 *   restoreFocus?: boolean
 * }} options
 */

const closeDropdown = (root, { restoreFocus = false } = {}) => {
  const parts = getDropdownParts(root);

  if (!parts) {
    return;
  }

  const { trigger, menu } = parts;
  const wasOpen = isDropdownOpen(root);

  trigger.setAttribute("aria-expanded", "false");

  menu.hidden = true;
  menu.classList.remove(CLASSES.open);
  menu.removeAttribute("data-open");

  root.classList.remove(CLASSES.open);

  if (activeDropdown === root) {
    activeDropdown = null;
  }

  if (restoreFocus) {
    trigger.focus();
  }

  if (!wasOpen) {
    return;
  }

  root.dispatchEvent(
    new CustomEvent("dropdown:close", {
      bubbles: true,
      detail: {
        trigger,
        menu,
      },
    }),
  );
};

/**
 * Closes the currently active dropdown.
 *
 * @param {HTMLElement | null} exceptRoot
 * @param {{ restoreFocus?: boolean }} options
 */

const closeActiveDropdown = (
  exceptRoot = null,
  { restoreFocus = false } = {},
) => {
  if (!activeDropdown || activeDropdown === exceptRoot) {
    return;
  }

  closeDropdown(activeDropdown, {
    restoreFocus,
  });
};

/**
 * Opens one dropdown.
 *
 * @param {HTMLElement} root
 * @param {{
 *   focus?: "first" | "last" | false
 * }} options
 */

const openDropdown = (root, { focus = false } = {}) => {
  const parts = getDropdownParts(root);

  if (!parts) {
    return;
  }

  const { trigger, menu } = parts;

  if (isDisabled(trigger)) {
    return;
  }

  if (isDropdownOpen(root)) {
    if (focus) {
      const items = getMenuItems(root);
      const target = focus === "last" ? items.at(-1) : items[0];

      target?.focus();
    }

    return;
  }

  closeActiveDropdown(root);

  trigger.setAttribute("aria-expanded", "true");

  menu.hidden = false;
  menu.classList.add(CLASSES.open);
  menu.dataset.open = "true";

  root.classList.add(CLASSES.open);

  activeDropdown = root;

  if (focus) {
    const items = getMenuItems(root);

    const target = focus === "last" ? items.at(-1) : items[0];

    target?.focus();
  }

  root.dispatchEvent(
    new CustomEvent("dropdown:open", {
      bubbles: true,
      detail: {
        trigger,
        menu,
      },
    }),
  );
};

/**
 * Toggles one dropdown.
 *
 * @param {HTMLElement} root
 * @param {{
 *   focus?: "first" | "last" | false
 * }} options
 */

const toggleDropdown = (root, { focus = false } = {}) => {
  if (isDropdownOpen(root)) {
    closeDropdown(root);
    return;
  }

  openDropdown(root, {
    focus,
  });
};

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initializes one dropdown.
 *
 * Dropdown triggers are expected to be buttons. Button triggers are normalized
 * to type="button" so they cannot accidentally submit a surrounding form.
 *
 * @param {HTMLElement} root
 */

const initializeDropdown = (root) => {
  if (initializedDropdowns.has(root)) {
    return;
  }

  const parts = getDropdownParts(root);

  if (!parts) {
    return;
  }

  const { trigger, menu } = parts;

  if (trigger instanceof HTMLButtonElement && !trigger.hasAttribute("type")) {
    trigger.type = "button";
  }

  if (!trigger.id) {
    trigger.id = createUniqueId("dropdown-trigger");
  }

  if (!menu.id) {
    menu.id = createUniqueId("dropdown-menu");
  }

  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", menu.id);

  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-labelledby", trigger.id);

  menu.hidden = true;
  menu.classList.remove(CLASSES.open);
  menu.removeAttribute("data-open");

  root.classList.remove(CLASSES.open);

  initializedDropdowns.add(root);
};

/**
 * Initializes all dropdowns inside a scope.
 *
 * @param {ParentNode} scope
 */

const initializeDropdownsIn = (scope = document) => {
  if (scope instanceof HTMLElement && scope.matches(SELECTORS.root)) {
    initializeDropdown(scope);
  }

  scope
    .querySelectorAll?.(SELECTORS.root)
    .forEach((root) => initializeDropdown(root));
};

/* ==========================================================================
   Click
   ========================================================================== */

const handleDocumentClick = (event) => {
  const target = getEventElement(event);

  if (!target) {
    return;
  }

  const trigger = target.closest(SELECTORS.trigger);

  if (trigger instanceof HTMLElement) {
    const root = trigger.closest(SELECTORS.root);

    if (
      root instanceof HTMLElement &&
      trigger.closest(SELECTORS.root) === root
    ) {
      if (isDisabled(trigger)) {
        event.preventDefault();
        return;
      }

      /*
       * Menu-button activation moves focus into the menu.
       * Native buttons already translate Enter and Space into click events,
       * so keyboard activation follows this same path.
       */
      toggleDropdown(root, {
        focus: "first",
      });

      return;
    }
  }

  const menuItem = target.closest(SELECTORS.item);

  if (menuItem instanceof HTMLElement) {
    const root = menuItem.closest(SELECTORS.root);

    if (root instanceof HTMLElement && !isDisabled(menuItem)) {
      closeDropdown(root);
      return;
    }
  }

  if (activeDropdown && !activeDropdown.contains(target)) {
    closeDropdown(activeDropdown);
  }
};

/* ==========================================================================
   Keyboard
   ========================================================================== */

const handleDocumentKeydown = (event) => {
  const target = getEventElement(event);

  if (!target) {
    return;
  }

  const trigger = target.closest(SELECTORS.trigger);

  if (trigger instanceof HTMLElement) {
    const root = trigger.closest(SELECTORS.root);

    if (!(root instanceof HTMLElement)) {
      return;
    }

    if (isDisabled(trigger)) {
      return;
    }

    switch (event.key) {
      /*
       * Enter and Space are intentionally not handled here.
       *
       * Native buttons already activate through click for these keys.
       * Handling them here as well would cause duplicate toggles.
       */

      case "ArrowDown":
        event.preventDefault();

        openDropdown(root, {
          focus: "first",
        });

        return;

      case "ArrowUp":
        event.preventDefault();

        openDropdown(root, {
          focus: "last",
        });

        return;

      case "Escape":
        if (isDropdownOpen(root)) {
          event.preventDefault();
          closeDropdown(root);
        }

        return;

      default:
        return;
    }
  }

  const menuItem = target.closest(SELECTORS.item);

  if (!(menuItem instanceof HTMLElement)) {
    if (event.key === "Escape" && activeDropdown) {
      event.preventDefault();

      closeDropdown(activeDropdown, {
        restoreFocus: true,
      });
    }

    return;
  }

  const root = menuItem.closest(SELECTORS.root);

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const items = getMenuItems(root);

  if (items.length === 0) {
    return;
  }

  const currentIndex = items.indexOf(menuItem);

  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;

  switch (event.key) {
    case "ArrowDown":
      nextIndex = (currentIndex + 1) % items.length;
      break;

    case "ArrowUp":
      nextIndex = (currentIndex - 1 + items.length) % items.length;
      break;

    case "Home":
      nextIndex = 0;
      break;

    case "End":
      nextIndex = items.length - 1;
      break;

    case "Escape":
      event.preventDefault();

      closeDropdown(root, {
        restoreFocus: true,
      });

      return;

    case "Tab":
      /*
       * Do not trap focus. The menu closes and normal browser tab navigation
       * continues to the next focusable element.
       */
      closeDropdown(root);
      return;

    default:
      return;
  }

  event.preventDefault();

  items[nextIndex]?.focus();
};

/* ==========================================================================
   Focus
   ========================================================================== */

const handleDocumentFocusIn = (event) => {
  if (!activeDropdown || !(event.target instanceof Node)) {
    return;
  }

  if (!activeDropdown.contains(event.target)) {
    closeDropdown(activeDropdown);
  }
};

/* ==========================================================================
   Dynamic Content
   ========================================================================== */

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      initializeDropdownsIn(node);
    });
  });
});

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Initializes the reusable dropdown system.
 */

export const initDropdowns = () => {
  initializeDropdownsIn(document);

  if (globalListenersBound) {
    return;
  }

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("focusin", handleDocumentFocusIn);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  globalListenersBound = true;
};

/**
 * Programmatically opens a dropdown.
 *
 * @param {HTMLElement} root
 * @param {{
 *   focus?: "first" | "last" | false
 * }} options
 */

export const showDropdown = (root, options = {}) => {
  initializeDropdown(root);
  openDropdown(root, options);
};

/**
 * Programmatically closes a dropdown.
 *
 * @param {HTMLElement} root
 * @param {{ restoreFocus?: boolean }} options
 */

export const hideDropdown = (root, options = {}) => {
  closeDropdown(root, options);
};
