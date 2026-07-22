const SCROLL_TOP_SELECTOR = "[data-scroll-top]";
const VISIBLE_CLASS = "is-visible";

const DEFAULT_THRESHOLD = 400;

function getScrollPosition() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initScrollTop() {
  const button = document.querySelector(SCROLL_TOP_SELECTOR);

  if (!button) return;

  const threshold =
    Number(button.getAttribute("data-scroll-threshold")) || DEFAULT_THRESHOLD;

  let isTicking = false;

  function updateVisibility() {
    const isVisible = getScrollPosition() > threshold;

    button.classList.toggle(VISIBLE_CLASS, isVisible);
    button.setAttribute("aria-hidden", String(!isVisible));
    button.tabIndex = isVisible ? 0 : -1;

    isTicking = false;
  }

  function handleScroll() {
    if (isTicking) return;

    isTicking = true;

    window.requestAnimationFrame(updateVisibility);
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  button.setAttribute("aria-hidden", "true");
  button.tabIndex = -1;

  updateVisibility();

  window.addEventListener("scroll", handleScroll, {
    passive: true,
  });

  button.addEventListener("click", scrollToTop);
}
