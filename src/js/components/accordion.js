const ACCORDION_TRIGGER = "[data-accordion-trigger]";

function closeItem(item) {
  const trigger = item.querySelector(ACCORDION_TRIGGER);
  const panel = item.querySelector(".accordion-panel");

  item.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  panel?.setAttribute("hidden", "");
}

function openItem(item) {
  const trigger = item.querySelector(ACCORDION_TRIGGER);
  const panel = item.querySelector(".accordion-panel");

  item.classList.add("is-open");
  trigger?.setAttribute("aria-expanded", "true");
  panel?.removeAttribute("hidden");
}

export function initAccordions() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(ACCORDION_TRIGGER);

    if (!trigger) return;

    const item = trigger.closest(".accordion-item");
    const accordion = trigger.closest(".accordion");

    if (!item || !accordion) return;

    const isOpen = item.classList.contains("is-open");
    const allowMultiple = accordion.hasAttribute("data-accordion-multiple");

    if (!allowMultiple) {
      accordion.querySelectorAll(".accordion-item.is-open").forEach(closeItem);
    }

    if (!isOpen) {
      openItem(item);
    } else {
      closeItem(item);
    }
  });
}
