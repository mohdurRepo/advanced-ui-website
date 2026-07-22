const OPEN_SELECTOR = "[data-modal-open]";
const CLOSE_SELECTOR = "[data-modal-close]";
const MODAL_SELECTOR = ".modal";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let activeModal = null;
let activeTrigger = null;
let previousBodyOverflow = "";
let initialized = false;

function getModal(id) {
  if (!id) return null;

  return document.getElementById(id);
}

function getFocusableElements(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      return (
        !element.hasAttribute("hidden") &&
        element.getAttribute("aria-hidden") !== "true"
      );
    },
  );
}

function lockBody() {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
}

function unlockBody() {
  document.body.style.overflow = previousBodyOverflow;
  previousBodyOverflow = "";
}

function focusInitialElement(modal) {
  const preferredTarget = modal.querySelector("[data-modal-initial-focus]");

  const fallbackTarget =
    modal.querySelector("[data-modal-close]") ??
    getFocusableElements(modal)[0] ??
    modal.querySelector(".modal-content");

  const focusTarget = preferredTarget ?? fallbackTarget;

  if (!focusTarget) return;

  if (
    focusTarget.matches(".modal-content") &&
    !focusTarget.hasAttribute("tabindex")
  ) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  requestAnimationFrame(() => {
    focusTarget.focus();
  });
}

function trapFocus(event) {
  if (event.key !== "Tab" || !activeModal) {
    return;
  }

  const focusableElements = getFocusableElements(activeModal);

  if (!focusableElements.length) {
    event.preventDefault();

    activeModal.querySelector(".modal-content")?.focus();

    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

export function openModal(modal, trigger = null) {
  if (!modal) return;

  if (activeModal && activeModal !== modal) {
    closeModal(activeModal, {
      restoreFocus: false,
    });
  }

  activeModal = modal;
  activeTrigger = trigger ?? document.activeElement;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");

  lockBody();
  focusInitialElement(modal);
}

export function closeModal(modal = activeModal, { restoreFocus = true } = {}) {
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");

  const triggerToRestore = activeTrigger;

  activeModal = null;
  activeTrigger = null;

  unlockBody();

  if (restoreFocus && triggerToRestore instanceof HTMLElement) {
    requestAnimationFrame(() => {
      triggerToRestore.focus();
    });
  }
}

function handleDocumentClick(event) {
  const openTrigger = event.target.closest(OPEN_SELECTOR);

  if (openTrigger) {
    const modal = getModal(openTrigger.dataset.modalOpen);

    openModal(modal, openTrigger);
    return;
  }

  const closeTrigger = event.target.closest(CLOSE_SELECTOR);

  if (closeTrigger) {
    closeModal(closeTrigger.closest(MODAL_SELECTOR));
  }
}

function handleDocumentKeydown(event) {
  if (!activeModal) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  trapFocus(event);
}

export function initModals() {
  if (initialized) return;

  initialized = true;

  document.addEventListener("click", handleDocumentClick);

  document.addEventListener("keydown", handleDocumentKeydown);
}
