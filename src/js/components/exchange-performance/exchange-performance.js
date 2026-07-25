/* ==========================================================================
   Exchange Performance Counters
   ========================================================================== */

const SELECTORS = {
  root: ".exchange-performance",
  counter: "[data-count-up]",
};

const initializedCounters = new WeakSet();
const animationFrames = new WeakMap();

let counterObserver = null;
let globalEventsInitialized = false;

/* ==========================================================================
   Preferences
   ========================================================================== */

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getNumberLocale() {
  return "en-US-u-nu-latn";
}

/* ==========================================================================
   Counter Configuration
   ========================================================================== */

function getCounterConfiguration(counter) {
  const target = Number(counter.dataset.countTo);
  const start = Number(counter.dataset.countFrom ?? 0);
  const decimals = Math.max(0, Number(counter.dataset.countDecimals ?? 0));
  const duration = Math.max(0, Number(counter.dataset.countDuration ?? 2400));

  if (!Number.isFinite(target)) {
    return null;
  }

  return {
    target,
    start: Number.isFinite(start) ? start : 0,
    decimals: Number.isFinite(decimals) ? decimals : 0,
    duration: Number.isFinite(duration) ? duration : 2400,
  };
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

function formatCounterValue(value, decimals) {
  return new Intl.NumberFormat(getNumberLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}

function renderCounterValue(counter, value, decimals) {
  counter.textContent = formatCounterValue(value, decimals);
}

/* ==========================================================================
   Animation
   ========================================================================== */

function easeOutQuart(progress) {
  return 1 - (1 - progress) ** 4;
}

function cancelCounterAnimation(counter) {
  const frame = animationFrames.get(counter);

  if (frame === undefined) return;

  window.cancelAnimationFrame(frame);
  animationFrames.delete(counter);
}

function completeCounter(counter) {
  const configuration = getCounterConfiguration(counter);

  if (!configuration) return;

  cancelCounterAnimation(counter);

  renderCounterValue(counter, configuration.target, configuration.decimals);

  counter.dataset.countAnimated = "true";

  counterObserver?.unobserve(counter);
}

function animateCounter(counter) {
  const configuration = getCounterConfiguration(counter);

  if (!configuration) return;
  if (counter.dataset.countAnimated === "true") return;

  const { start, target, decimals, duration } = configuration;

  if (prefersReducedMotion() || duration === 0 || start === target) {
    completeCounter(counter);
    return;
  }

  cancelCounterAnimation(counter);

  const startedAt = performance.now();
  const difference = target - start;

  function update(currentTime) {
    const elapsed = currentTime - startedAt;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuart(progress);
    const currentValue = start + difference * easedProgress;

    renderCounterValue(counter, currentValue, decimals);

    if (progress < 1) {
      const frame = window.requestAnimationFrame(update);

      animationFrames.set(counter, frame);
      return;
    }

    animationFrames.delete(counter);
    completeCounter(counter);
  }

  renderCounterValue(counter, start, decimals);

  const frame = window.requestAnimationFrame(update);

  animationFrames.set(counter, frame);
}

/* ==========================================================================
   Intersection Observer
   ========================================================================== */

function getCounterObserver() {
  if (counterObserver) {
    return counterObserver;
  }

  if (!("IntersectionObserver" in window)) {
    return null;
  }

  counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.3,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  return counterObserver;
}

/* ==========================================================================
   Counter Initialization
   ========================================================================== */

function initializeCounter(counter) {
  if (initializedCounters.has(counter)) return;

  const configuration = getCounterConfiguration(counter);

  if (!configuration) return;

  initializedCounters.add(counter);

  /*
   * The target number remains in the HTML until the section enters the
   * viewport. This provides a meaningful no-JavaScript fallback and avoids
   * displaying zero while the page is loading.
   */
  if (prefersReducedMotion()) {
    completeCounter(counter);
    return;
  }

  const observer = getCounterObserver();

  if (!observer) {
    completeCounter(counter);
    return;
  }

  observer.observe(counter);
}

function initializePerformanceSection(section) {
  section.querySelectorAll(SELECTORS.counter).forEach(initializeCounter);
}

/* ==========================================================================
   Preference Synchronization
   ========================================================================== */

function getAllCounters() {
  return Array.from(
    document.querySelectorAll(`${SELECTORS.root} ${SELECTORS.counter}`),
  );
}

function refreshCounterFormats() {
  getAllCounters().forEach((counter) => {
    const configuration = getCounterConfiguration(counter);

    if (!configuration) return;

    /*
     * Active animations are completed before applying a new locale so the
     * old and new numeral systems are never mixed in the same animation.
     */
    if (animationFrames.has(counter)) {
      completeCounter(counter);
      return;
    }

    renderCounterValue(counter, configuration.target, configuration.decimals);
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name === "lang") {
    refreshCounterFormats();
    return;
  }

  if (event.detail?.name === "motion" && prefersReducedMotion()) {
    getAllCounters().forEach(completeCounter);
  }
}

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  document.addEventListener("languagechange", refreshCounterFormats);
  document.addEventListener("preferencechange", handlePreferenceChange);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initExchangePerformance() {
  const sections = document.querySelectorAll(SELECTORS.root);

  if (!sections.length) return;

  sections.forEach(initializePerformanceSection);

  initializeGlobalEvents();
}
