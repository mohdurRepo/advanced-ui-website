const OPEN_SELECTOR = "[data-modal-open]";
const CLOSE_SELECTOR = "[data-modal-close]";
const MODAL_SELECTOR = ".modal";

let activeModal = null;

function getModal(id) {
  return document.getElementById(id);
}

function lockBody() {
  document.body.style.overflow = "hidden";
}

function unlockBody() {
  document.body.style.overflow = "";
}

export function openModal(modal) {
  if (!modal) return;

  activeModal = modal;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");

  lockBody();

  const focusTarget = modal.querySelector(
    "[data-modal-close], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
  );

  focusTarget?.focus();
}

export function closeModal(modal = activeModal) {
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");

  activeModal = null;
  unlockBody();
}

export function initModals() {
  document.addEventListener("click", (event) => {
    const openTrigger = event.target.closest(OPEN_SELECTOR);

    if (openTrigger) {
      const modal = getModal(openTrigger.dataset.modalOpen);
      openModal(modal);
      return;
    }

    const closeTrigger = event.target.closest(CLOSE_SELECTOR);

    if (closeTrigger) {
      closeModal(closeTrigger.closest(MODAL_SELECTOR));
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}
