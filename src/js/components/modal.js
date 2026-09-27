/* ==========================================================================
   Modal
   ========================================================================== */

const OPEN_SELECTOR = "[data-modal-open]";
const CLOSE_SELECTOR = "[data-modal-close]";
const MODAL_SELECTOR = ".modal";
const DIALOG_SELECTOR = ".modal-dialog";
const CONTENT_SELECTOR = ".modal-content";
const BACKDROP_SELECTOR = ".modal-backdrop";

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
   General Helpers
   ========================================================================== */

function isElement(value) {
  return value instanceof HTMLElement;
}

function isDisabled(element) {
  if (!isElement(element)) {
    return false;
  }

  return Boolean(
    element.disabled ||
    element.classList.contains("is-disabled") ||
    element.getAttribute("aria-disabled") === "true",
  );
}

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

  if (!isElement(modal) || !modal.matches(MODAL_SELECTOR)) {
    return null;
  }

  return modal;
}

/* ==========================================================================
   Modal Portal
   ========================================================================== */

/**
 * Move a modal to document.body.
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
   ARIA Setup
   ========================================================================== */

function ensureModalRelationships(modal) {
  const content = modal.querySelector(CONTENT_SELECTOR);

  const title = modal.querySelector(".modal-title");

  if (!isElement(content)) {
    return;
  }

  if (!content.hasAttribute("role")) {
    content.setAttribute("role", "dialog");
  }

  content.setAttribute("aria-modal", "true");

  if (isElement(title)) {
    if (!title.id) {
      title.id = `${modal.id || "modal"}-title`;
    }

    if (!content.hasAttribute("aria-labelledby")) {
      content.setAttribute("aria-labelledby", title.id);
    }
  }

  if (!content.hasAttribute("tabindex")) {
    content.setAttribute("tabindex", "-1");
  }
}

/* ==========================================================================
   Focus Management
   ========================================================================== */

/**
 * Return visible interactive elements owned by a modal.
 *
 * @param {HTMLElement} modal
 * @returns {HTMLElement[]}
 */

function getFocusableElements(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (!isElement(element)) {
        return false;
      }

      if (
        isDisabled(element) ||
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
 * Focus the preferred initial element.
 *
 * @param {HTMLElement} modal
 */

function focusInitialElement(modal) {
  const preferredTarget = modal.querySelector("[data-modal-initial-focus]");

  const fallbackTarget =
    modal.querySelector(CLOSE_SELECTOR) ??
    getFocusableElements(modal)[0] ??
    modal.querySelector(CONTENT_SELECTOR);

  const focusTarget = isElement(preferredTarget)
    ? preferredTarget
    : fallbackTarget;

  if (!isElement(focusTarget)) {
    return;
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

  const content = activeModal.querySelector(CONTENT_SELECTOR);

  if (!focusableElements.length) {
    event.preventDefault();

    if (isElement(content)) {
      content.focus({
        preventScroll: true,
      });
    }

    return;
  }

  const firstElement = focusableElements[0];

  const lastElement = focusableElements[focusableElements.length - 1];

  const currentElement = document.activeElement;

  if (
    !(currentElement instanceof Node) ||
    !activeModal.contains(currentElement)
  ) {
    event.preventDefault();

    firstElement.focus({
      preventScroll: true,
    });

    return;
  }

  if (event.shiftKey && currentElement === firstElement) {
    event.preventDefault();

    lastElement.focus({
      preventScroll: true,
    });

    return;
  }

  if (!event.shiftKey && currentElement === lastElement) {
    event.preventDefault();

    firstElement.focus({
      preventScroll: true,
    });
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
  if (!isElement(modal)) {
    return false;
  }

  if (activeModal === modal) {
    return false;
  }

  if (activeModal) {
    closeModal(activeModal, {
      restoreFocus: false,
    });
  }

  activeModal = modal;

  activeTrigger = isElement(trigger)
    ? trigger
    : isElement(document.activeElement)
      ? document.activeElement
      : null;

  mountModal(modal);

  ensureModalRelationships(modal);

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

  return true;
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
  if (!isElement(modal)) {
    return false;
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
    isElement(triggerToRestore) &&
    triggerToRestore.isConnected
  ) {
    requestAnimationFrame(() => {
      triggerToRestore.focus({
        preventScroll: true,
      });
    });
  }

  return true;
}

/* ==========================================================================
   Backdrop
   ========================================================================== */

function shouldCloseFromBackdrop(modal) {
  return modal.dataset.modalStatic !== "true";
}

/* ==========================================================================
   Document Click
   ========================================================================== */

function handleDocumentClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const openTrigger = event.target.closest(OPEN_SELECTOR);

  if (isElement(openTrigger)) {
    if (isDisabled(openTrigger)) {
      event.preventDefault();
      return;
    }

    const modal = getModal(openTrigger.dataset.modalOpen);

    if (!modal) {
      return;
    }

    event.preventDefault();

    openModal(modal, openTrigger);

    return;
  }

  const closeTrigger = event.target.closest(CLOSE_SELECTOR);

  if (isElement(closeTrigger)) {
    if (isDisabled(closeTrigger)) {
      event.preventDefault();
      return;
    }

    const modal = closeTrigger.closest(MODAL_SELECTOR);

    if (!isElement(modal)) {
      return;
    }

    event.preventDefault();

    closeModal(modal);

    return;
  }

  const backdrop = event.target.closest(BACKDROP_SELECTOR);

  if (!isElement(backdrop)) {
    return;
  }

  const modal = backdrop.closest(MODAL_SELECTOR);

  if (
    !isElement(modal) ||
    modal !== activeModal ||
    !shouldCloseFromBackdrop(modal)
  ) {
    return;
  }

  event.preventDefault();

  closeModal(modal);
}

/* ==========================================================================
   Keyboard
   ========================================================================== */

function handleDocumentKeydown(event) {
  if (!activeModal) {
    return;
  }

  if (event.key === "Escape") {
    if (activeModal.dataset.modalStatic === "true") {
      return;
    }

    event.preventDefault();

    closeModal();

    return;
  }

  trapFocus(event);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeModal(modal) {
  if (!isElement(modal)) {
    return;
  }

  ensureModalRelationships(modal);

  if (!modal.classList.contains("is-open")) {
    modal.hidden = true;

    modal.setAttribute("aria-hidden", "true");
  }
}

/**
 * Initialize modal infrastructure.
 */

export function initModals() {
  if (initialized) {
    return;
  }

  initialized = true;

  document.querySelectorAll(MODAL_SELECTOR).forEach(initializeModal);

  document.addEventListener("click", handleDocumentClick);

  document.addEventListener("keydown", handleDocumentKeydown);
}
