const OPEN_SELECTOR = "[data-modal-open]";
const CLOSE_SELECTOR = "[data-modal-close]";
const MODAL_SELECTOR = ".modal";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const modalOrigins = new WeakMap();

let activeModal = null;
let activeTrigger = null;
let previousBodyOverflow = "";
let previousBodyPaddingInlineEnd = "";
let initialized = false;

/* ==========================================================================
   Modal Lookup
   ========================================================================== */

/**
 * Return a modal by its element ID.
 *
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function getModal(id) {
  if (!id) {
    return null;
  }

  const modal = document.getElementById(id);

  if (!(modal instanceof HTMLElement) || !modal.matches(MODAL_SELECTOR)) {
    return null;
  }

  return modal;
}

/* ==========================================================================
   Modal Portal
   ========================================================================== */

/**
 * Move a modal to the document body.
 *
 * This prevents transformed, isolated, filtered, or contained ancestors from
 * trapping the modal inside their stacking context.
 *
 * @param {HTMLElement} modal
 */
function mountModal(modal) {
  if (modal.parentElement === document.body) {
    return;
  }

  if (modalOrigins.has(modal)) {
    return;
  }

  const placeholder = document.createComment(
    `modal-origin:${modal.id || "anonymous"}`,
  );

  modal.before(placeholder);

  modalOrigins.set(modal, placeholder);

  document.body.append(modal);
}

/**
 * Return a modal to its original DOM position.
 *
 * @param {HTMLElement} modal
 */
function unmountModal(modal) {
  const placeholder = modalOrigins.get(modal);

  if (!(placeholder instanceof Comment)) {
    return;
  }

  if (placeholder.parentNode) {
    placeholder.replaceWith(modal);
  }

  modalOrigins.delete(modal);
}

/* ==========================================================================
   Focus Management
   ========================================================================== */

/**
 * Return the visible, interactive elements owned by a modal.
 *
 * @param {HTMLElement} modal
 * @returns {HTMLElement[]}
 */
function getFocusableElements(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (
        element.hidden ||
        element.getAttribute("aria-hidden") === "true" ||
        element.closest("[hidden]") ||
        element.closest('[aria-hidden="true"]')
      ) {
        return false;
      }

      return element.getClientRects().length > 0;
    },
  );
}

/**
 * Focus the preferred initial element inside a modal.
 *
 * @param {HTMLElement} modal
 */
function focusInitialElement(modal) {
  const preferredTarget = modal.querySelector("[data-modal-initial-focus]");

  const fallbackTarget =
    modal.querySelector(CLOSE_SELECTOR) ??
    getFocusableElements(modal)[0] ??
    modal.querySelector(".modal-content");

  const focusTarget = preferredTarget ?? fallbackTarget;

  if (!(focusTarget instanceof HTMLElement)) {
    return;
  }

  if (
    focusTarget.matches(".modal-content") &&
    !focusTarget.hasAttribute("tabindex")
  ) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  requestAnimationFrame(() => {
    focusTarget.focus({
      preventScroll: true,
    });
  });
}

/**
 * Keep keyboard focus inside the active modal.
 *
 * @param {KeyboardEvent} event
 */
function trapFocus(event) {
  if (event.key !== "Tab" || !activeModal) {
    return;
  }

  const focusableElements = getFocusableElements(activeModal);

  if (!focusableElements.length) {
    event.preventDefault();

    activeModal.querySelector(".modal-content")?.focus({
      preventScroll: true,
    });

    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const currentElement = document.activeElement;

  if (!activeModal.contains(currentElement)) {
    event.preventDefault();

    firstElement.focus();

    return;
  }

  if (event.shiftKey && currentElement === firstElement) {
    event.preventDefault();

    lastElement.focus();

    return;
  }

  if (!event.shiftKey && currentElement === lastElement) {
    event.preventDefault();

    firstElement.focus();
  }
}

/* ==========================================================================
   Page Scroll Lock
   ========================================================================== */

/**
 * Lock document scrolling without causing horizontal layout movement.
 */
function lockPageScroll() {
  if (document.documentElement.classList.contains("has-open-modal")) {
    return;
  }

  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  previousBodyOverflow = document.body.style.overflow;
  previousBodyPaddingInlineEnd = document.body.style.paddingInlineEnd;

  document.documentElement.style.setProperty(
    "--modal-scrollbar-width",
    `${Math.max(0, scrollbarWidth)}px`,
  );

  document.documentElement.classList.add("has-open-modal");
  document.body.classList.add("has-open-modal");

  document.body.style.overflow = "hidden";

  if (scrollbarWidth > 0) {
    document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;
  }
}

/**
 * Restore document scrolling.
 */
function unlockPageScroll() {
  document.documentElement.classList.remove("has-open-modal");
  document.body.classList.remove("has-open-modal");

  document.body.style.overflow = previousBodyOverflow;
  document.body.style.paddingInlineEnd = previousBodyPaddingInlineEnd;

  document.documentElement.style.removeProperty("--modal-scrollbar-width");

  previousBodyOverflow = "";
  previousBodyPaddingInlineEnd = "";
}

/* ==========================================================================
   Open
   ========================================================================== */

/**
 * Open a modal.
 *
 * @param {HTMLElement} modal
 * @param {HTMLElement | null} trigger
 */
export function openModal(modal, trigger = null) {
  if (!(modal instanceof HTMLElement)) {
    return;
  }

  if (activeModal === modal) {
    return;
  }

  if (activeModal) {
    closeModal(activeModal, {
      restoreFocus: false,
    });
  }

  activeModal = modal;

  activeTrigger =
    trigger instanceof HTMLElement
      ? trigger
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

  mountModal(modal);

  modal.hidden = false;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");

  lockPageScroll();
  focusInitialElement(modal);

  modal.dispatchEvent(
    new CustomEvent("modal:open", {
      bubbles: true,
      detail: {
        modal,
        trigger: activeTrigger,
      },
    }),
  );
}

/* ==========================================================================
   Close
   ========================================================================== */

/**
 * Close a modal.
 *
 * @param {HTMLElement | null} modal
 * @param {{ restoreFocus?: boolean }} options
 */
export function closeModal(modal = activeModal, { restoreFocus = true } = {}) {
  if (!(modal instanceof HTMLElement)) {
    return;
  }

  const triggerToRestore = modal === activeModal ? activeTrigger : null;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;

  if (modal === activeModal) {
    activeModal = null;
    activeTrigger = null;

    unlockPageScroll();
  }

  unmountModal(modal);

  modal.dispatchEvent(
    new CustomEvent("modal:close", {
      bubbles: true,
      detail: {
        modal,
        trigger: triggerToRestore,
      },
    }),
  );

  if (
    restoreFocus &&
    triggerToRestore instanceof HTMLElement &&
    triggerToRestore.isConnected
  ) {
    requestAnimationFrame(() => {
      triggerToRestore.focus({
        preventScroll: true,
      });
    });
  }
}

/* ==========================================================================
   Document Click
   ========================================================================== */

function handleDocumentClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const openTrigger = event.target.closest(OPEN_SELECTOR);

  if (openTrigger instanceof HTMLElement) {
    const modal = getModal(openTrigger.dataset.modalOpen);

    if (!modal) {
      return;
    }

    event.preventDefault();

    openModal(modal, openTrigger);

    return;
  }

  const closeTrigger = event.target.closest(CLOSE_SELECTOR);

  if (closeTrigger instanceof HTMLElement) {
    const modal = closeTrigger.closest(MODAL_SELECTOR);

    if (!(modal instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();

    closeModal(modal);
  }
}

/* ==========================================================================
   Keyboard
   ========================================================================== */

function handleDocumentKeydown(event) {
  if (!activeModal) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();

    closeModal();

    return;
  }

  trapFocus(event);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initModals() {
  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
}
