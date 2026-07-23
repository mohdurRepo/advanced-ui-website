const SCROLL_TOP_SELECTOR = "[data-scroll-top]";
const CHAT_TRIGGER_SELECTOR = ".chat-trigger, [data-chat-toggle]";

const VISIBLE_CLASS = "is-visible";
const CHAT_BODY_CLASS = "has-chat-trigger";

const DEFAULT_THRESHOLD = 400;

let initializedButton = null;
let chatObserver = null;

/* ==========================================================================
   Helpers
   ========================================================================== */

function getScrollPosition() {
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  );
}

function getThreshold(button) {
  const attribute = button.getAttribute("data-scroll-threshold");

  if (attribute === null || attribute.trim() === "") {
    return DEFAULT_THRESHOLD;
  }

  const threshold = Number(attribute);

  return Number.isFinite(threshold) && threshold >= 0
    ? threshold
    : DEFAULT_THRESHOLD;
}

function prefersReducedMotion() {
  return (
    document.documentElement.getAttribute("data-motion") === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getChatTrigger() {
  return document.querySelector(CHAT_TRIGGER_SELECTOR);
}

function isChatAvailable(chatTrigger) {
  if (!chatTrigger) return false;

  return (
    !chatTrigger.hidden &&
    !chatTrigger.classList.contains("is-hidden") &&
    chatTrigger.getAttribute("aria-hidden") !== "true"
  );
}

/* ==========================================================================
   Chat-aware Layout
   ========================================================================== */

function syncChatPresence() {
  const chatTrigger = getChatTrigger();
  const hasVisibleChat = isChatAvailable(chatTrigger);

  document.body.classList.toggle(CHAT_BODY_CLASS, hasVisibleChat);
}

function observeChatTrigger() {
  const chatTrigger = getChatTrigger();

  chatObserver?.disconnect();
  chatObserver = null;

  syncChatPresence();

  if (!chatTrigger) return;

  chatObserver = new MutationObserver(syncChatPresence);

  chatObserver.observe(chatTrigger, {
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden"],
  });
}

/* ==========================================================================
   Visibility
   ========================================================================== */

function setButtonVisibility(button, isVisible) {
  button.classList.toggle(VISIBLE_CLASS, isVisible);
  button.setAttribute("aria-hidden", String(!isVisible));
  button.tabIndex = isVisible ? 0 : -1;
}

function updateButtonVisibility(button, threshold) {
  const isVisible = getScrollPosition() > threshold;

  setButtonVisibility(button, isVisible);
}

/* ==========================================================================
   Scroll Action
   ========================================================================== */

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initScrollTop() {
  const button = document.querySelector(SCROLL_TOP_SELECTOR);

  if (!button) {
    document.body.classList.remove(CHAT_BODY_CLASS);
    return;
  }

  /*
   * The button's visibility is controlled by .is-visible.
   * Remove the native hidden attribute so CSS does not permanently hide it.
   */
  button.removeAttribute("hidden");

  const threshold = getThreshold(button);

  let isTicking = false;

  function updateVisibility() {
    updateButtonVisibility(button, threshold);
    isTicking = false;
  }

  function handleScroll() {
    if (isTicking) return;

    isTicking = true;
    window.requestAnimationFrame(updateVisibility);
  }

  /*
   * Prevent duplicate listeners if initialization is accidentally called
   * more than once.
   */
  if (initializedButton === button) {
    updateVisibility();
    syncChatPresence();
    return;
  }

  initializedButton = button;

  setButtonVisibility(button, false);
  observeChatTrigger();
  updateVisibility();

  window.addEventListener("scroll", handleScroll, {
    passive: true,
  });

  window.addEventListener("resize", handleScroll, {
    passive: true,
  });

  button.addEventListener("click", scrollToPageTop);
}
