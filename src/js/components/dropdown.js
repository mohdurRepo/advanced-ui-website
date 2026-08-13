/* ==========================================================================
   Dropdown
   ========================================================================== */

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

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Return the trigger and menu owned by a dropdown root.
 *
 * Nested dropdowns are excluded.
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
 * Return enabled menu items owned by one dropdown.
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
 * Check whether a trigger is disabled.
 *
 * @param {HTMLElement} trigger
 * @returns {boolean}
 */
const isTriggerDisabled = (trigger) =>
  trigger.matches(":disabled") ||
  trigger.classList.contains("is-disabled") ||
  trigger.getAttribute("aria-disabled") === "true";

/**
 * Check whether a dropdown is open.
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
   State
   ========================================================================== */

/**
 * Close one dropdown.
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
 * Close the currently active dropdown.
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
 * Open one dropdown.
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

  if (isTriggerDisabled(trigger)) {
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
 * Toggle one dropdown.
 *
 * @param {HTMLElement} root
 */
const toggleDropdown = (root) => {
  if (isDropdownOpen(root)) {
    closeDropdown(root);
    return;
  }

  openDropdown(root);
};

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initialize one dropdown.
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

  if (!trigger.hasAttribute("aria-haspopup")) {
    trigger.setAttribute("aria-haspopup", "menu");
  }

  trigger.setAttribute("aria-expanded", "false");

  if (!menu.hasAttribute("role")) {
    menu.setAttribute("role", "menu");
  }

  menu.hidden = true;

  if (menu.id) {
    trigger.setAttribute("aria-controls", menu.id);
  }

  initializedDropdowns.add(root);
};

/**
 * Initialize all dropdowns inside a scope.
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
  const trigger = event.target.closest(SELECTORS.trigger);

  if (trigger instanceof HTMLElement) {
    const root = trigger.closest(SELECTORS.root);

    if (root instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();

      toggleDropdown(root);
      return;
    }
  }

  const menuItem = event.target.closest(SELECTORS.item);

  if (menuItem instanceof HTMLElement) {
    const root = menuItem.closest(SELECTORS.root);

    if (
      root instanceof HTMLElement &&
      menuItem.getAttribute("aria-disabled") !== "true" &&
      !menuItem.classList.contains("is-disabled") &&
      !menuItem.matches(":disabled")
    ) {
      closeDropdown(root);
      return;
    }
  }

  if (
    activeDropdown &&
    event.target instanceof Node &&
    !activeDropdown.contains(event.target)
  ) {
    closeDropdown(activeDropdown);
  }
};

/* ==========================================================================
   Keyboard
   ========================================================================== */

const handleDocumentKeydown = (event) => {
  const trigger = event.target.closest(SELECTORS.trigger);

  if (trigger instanceof HTMLElement) {
    const root = trigger.closest(SELECTORS.root);

    if (!(root instanceof HTMLElement)) {
      return;
    }

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        toggleDropdown(root);
        return;

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

  const menuItem = event.target.closest(SELECTORS.item);

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

let globalListenersBound = false;

/**
 * Initialize the reusable dropdown system.
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
 * Programmatically open a dropdown.
 *
 * @param {HTMLElement} root
 */
export const showDropdown = (root) => {
  initializeDropdown(root);
  openDropdown(root);
};

/**
 * Programmatically close a dropdown.
 *
 * @param {HTMLElement} root
 * @param {{ restoreFocus?: boolean }} options
 */
export const hideDropdown = (root, options = {}) => {
  closeDropdown(root, options);
};
