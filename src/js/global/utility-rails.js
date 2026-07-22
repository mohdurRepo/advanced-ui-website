const UTILITY_RAIL_SELECTOR = "[data-utility-rail]";
const SEARCH_TRIGGER_SELECTOR = "[data-search-toggle]";
const CHAT_TRIGGER_SELECTOR = "[data-chat-toggle]";

function dispatchUtilityEvent(name, trigger) {
  document.dispatchEvent(
    new CustomEvent(`site:${name}`, {
      detail: {
        trigger,
      },
    }),
  );
}

function handleUtilityRailClick(event) {
  const searchTrigger = event.target.closest(SEARCH_TRIGGER_SELECTOR);

  if (searchTrigger) {
    dispatchUtilityEvent("search", searchTrigger);
    return;
  }

  const chatTrigger = event.target.closest(CHAT_TRIGGER_SELECTOR);

  if (chatTrigger) {
    dispatchUtilityEvent("chat", chatTrigger);
  }
}

function handleUtilityRailKeydown(event) {
  const trigger = event.target.closest(
    `${SEARCH_TRIGGER_SELECTOR}, ${CHAT_TRIGGER_SELECTOR}`,
  );

  if (!trigger) return;

  if (event.key !== "Enter" && event.key !== " ") return;

  /*
   * Native buttons already generate click events from Enter and Space.
   * This fallback only supports non-button interactive elements.
   */
  if (trigger instanceof HTMLButtonElement) return;

  event.preventDefault();
  trigger.click();
}

function initializeUtilityRail(rail) {
  rail
    .querySelectorAll(`${SEARCH_TRIGGER_SELECTOR}, ${CHAT_TRIGGER_SELECTOR}`)
    .forEach((trigger) => {
      if (
        !(trigger instanceof HTMLButtonElement) &&
        !trigger.hasAttribute("role")
      ) {
        trigger.setAttribute("role", "button");
      }

      if (
        !(trigger instanceof HTMLButtonElement) &&
        !trigger.hasAttribute("tabindex")
      ) {
        trigger.setAttribute("tabindex", "0");
      }
    });
}

export function initUtilityRails() {
  const rails = document.querySelectorAll(UTILITY_RAIL_SELECTOR);

  if (!rails.length) return;

  rails.forEach(initializeUtilityRail);

  document.addEventListener("click", handleUtilityRailClick);

  document.addEventListener("keydown", handleUtilityRailKeydown);
}
