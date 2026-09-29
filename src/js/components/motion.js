/* ==========================================================================
   Motion
   ========================================================================== */

/**
 * Progressive-enhancement motion runtime.
 *
 * Types (data-motion)
 *   reveal | type | words | chars | placeholder
 *
 * Authority
 *   The site preference <html data-motion-preference="reduce"> is the only
 *   switch. Operating-system motion settings are intentionally not read, so
 *   every visitor gets the same behaviour.
 *
 * Guarantees
 *   - no scroll listeners (IntersectionObserver only);
 *   - content is never lost if JavaScript fails, loads late or is blocked;
 *   - screen readers get the full text once;
 *   - no inline styles, no layout shift, no layout-property animation;
 *   - RTL handled in SCSS, not runtime direction math.
 *
 * State classes (read by SCSS)
 *   .motion-ready        on <html>: the runtime is active
 *   .is-motion-enhanced  text host has been prepared
 *   .is-motion-visible   element has entered and is animating in
 *   .is-motion-complete  finished; motion styles released
 *   .is-motion-in        this word / character has entered
 *
 * Timing
 *   Delays and staggers are scheduled here. Custom durations become shared,
 *   de-duplicated rules in one runtime stylesheet.
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

const MOTION_SELECTOR = "[data-motion]";
const GROUP_SELECTOR = "[data-motion-group]";
const ANY_MOTION_SELECTOR = `${MOTION_SELECTOR}, ${GROUP_SELECTOR}`;

const PREFERENCE_ATTRIBUTE = "data-motion-preference";

/* ==========================================================================
   Defaults
   ========================================================================== */

/**
 * Elements reveal when their top edge passes 12% above the viewport bottom.
 * Works for any element height, unlike a ratio threshold.
 */

const DEFAULT_THRESHOLD = 0;
const DEFAULT_ROOT_MARGIN = "0px 0px -12% 0px";

/* Fallbacks only; the real values come from motion/_config.scss. */

const DEFAULT_REVEAL_DURATION = 800;
const DEFAULT_TEXT_DURATION = 650;
const DEFAULT_TEXT_STAGGER = 40;
const DEFAULT_GROUP_STAGGER = 100;

/* Typing: milliseconds per character. */

const TYPING_SPEEDS = Object.freeze({
  fast: 30,
  normal: 45,
  slow: 70,
});

/* Natural pauses after punctuation (multiplier of typing speed). */

const SENTENCE_PAUSE = 8;
const CLAUSE_PAUSE = 4;

const SENTENCE_END = /[.!?؟…]$/u;
const CLAUSE_END = /[,;:،؛]$/u;

/* Small safety margin before releasing motion styles. */

const COMPLETION_BUFFER = 50;

/* Maximum wait for web fonts before the first sequence starts. */

const PAGE_READY_MAX_WAIT = 1200;

const PRESETS = new Set(["fast", "normal", "slow"]);

const SUPPORTED_TYPES = new Set([
  "reveal",
  "type",
  "words",
  "chars",
  "placeholder",
]);

const TEXT_TYPES = new Set(["type", "words", "chars"]);

/**
 * Cursive scripts whose letters join. Splitting them into separate boxes
 * breaks the joining, so `chars` falls back to word units for them.
 */

const CONNECTED_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Adlam}\p{Script=Mandaic}]/u;

/* ==========================================================================
   State
   ========================================================================== */

const initializedElements = new WeakSet();
const initializedGroups = new WeakSet();

const elementStates = new WeakMap();

/* Resolved start delay per element (group stagger + manual delay). */

const elementDelays = new WeakMap();

/* Pending delayed starts, so repeat mode can cancel them. */

const startTimers = new WeakMap();

/* Grapheme segmenters, one per language. */

const segmenters = new Map();

/* Runtime stylesheet for custom durations (see registerDurationRule). */

let runtimeSheet = null;

const registeredDurations = new Set();

/* Enter observers, pooled by threshold + rootMargin. */

const observerPool = new Map();

/* One exit observer for repeat-mode elements (see Intersection). */

let exitObserver = null;

let mutationObserver = null;
let preferenceObserver = null;

let initialized = false;

/*
 * pending  initialization is still deciding whether Motion can run;
 * enabled  the full runtime is available;
 * static   fallback: always show final content.
 */

let runtimeMode = "pending";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isElement(value) {
  return value instanceof HTMLElement;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Accepts "300", "300ms" or "0.3s". Returns milliseconds.
 */

function parseMilliseconds(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized.endsWith("ms")) {
    return Math.max(0, parseNumber(normalized.slice(0, -2), fallback));
  }

  if (normalized.endsWith("s")) {
    return Math.max(
      0,
      parseNumber(normalized.slice(0, -1), fallback / 1000) * 1000,
    );
  }

  return Math.max(0, parseNumber(normalized, fallback));
}

function readCssMilliseconds(element, property, fallback = 0) {
  const value = getComputedStyle(element).getPropertyValue(property).trim();

  return parseMilliseconds(value, fallback);
}

function getState(element) {
  let state = elementStates.get(element);

  if (!state) {
    state = {
      completionTimer: null,
    };

    elementStates.set(element, state);
  }

  return state;
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();

  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

/* ==========================================================================
   Motion Preference
   ========================================================================== */

function prefersReducedMotion() {
  return (
    document.documentElement.getAttribute(PREFERENCE_ATTRIBUTE) === "reduce"
  );
}

/**
 * True only when the runtime is active and the site allows motion.
 * Every start, step and resume re-checks this, so a preference change
 * takes effect immediately, even mid-animation.
 */

function canAnimate() {
  return runtimeMode === "enabled" && !prefersReducedMotion();
}

/**
 * If a required primitive is missing, Motion fails open and leaves content
 * in its final visible state.
 */

function supportsMotionRuntime() {
  return (
    typeof window.IntersectionObserver === "function" &&
    typeof window.MutationObserver === "function"
  );
}

/**
 * Public read-only motion preference.
 *
 * Other components should use this instead of their own checks, so the
 * whole site follows one setting.
 */

export function isReducedMotion() {
  return prefersReducedMotion();
}

/* ==========================================================================
   Motion Type
   ========================================================================== */

function getMotionType(element) {
  if (!isElement(element)) {
    return null;
  }

  const type = String(element.dataset.motion ?? "")
    .trim()
    .toLowerCase();

  return SUPPORTED_TYPES.has(type) ? type : null;
}

/* ==========================================================================
   Element Configuration
   ========================================================================== */

function getThreshold(element) {
  return clamp(
    parseNumber(element.dataset.motionThreshold, DEFAULT_THRESHOLD),
    0,
    1,
  );
}

function getRootMargin(element) {
  return element.dataset.motionRootMargin?.trim() || DEFAULT_ROOT_MARGIN;
}

function shouldRunOnce(element) {
  /* Looping placeholders stay observed so they can pause off screen. */

  if (getMotionType(element) === "placeholder") {
    return !isPlaceholderLoop(element);
  }

  return element.dataset.motionOnce !== "false";
}

function getManualDelay(element) {
  return parseMilliseconds(element.dataset.motionDelay, 0);
}

/**
 * Group items: group stagger + manual delay. Others: manual delay.
 */

function getDelay(element) {
  return elementDelays.get(element) ?? getManualDelay(element);
}

function hasStarted(element) {
  return (
    element.classList.contains("is-motion-visible") || startTimers.has(element)
  );
}

/* ==========================================================================
   Runtime Stylesheet
   ========================================================================== */

/**
 * data-motion-duration="400" cannot be expressed by the static presets, so
 * each distinct value receives one shared rule in a single runtime <style>:
 *
 *   [data-motion][data-motion-duration="400"] {
 *     --motion-duration: 400ms;
 *     --motion-text-duration: 400ms;
 *   }
 *
 * A plain <style> element is used instead of adoptedStyleSheets for the
 * widest browser support.
 */

function getRuntimeSheet() {
  if (runtimeSheet) {
    return runtimeSheet;
  }

  const style = document.createElement("style");

  style.dataset.motionRuntime = "";

  document.head.append(style);

  runtimeSheet = style.sheet;

  return runtimeSheet;
}

/**
 * Escapes a value for a quoted CSS attribute selector without relying on
 * CSS.escape().
 */

function escapeCssString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\a ")
    .replaceAll("\r", "\\d ")
    .replaceAll("\f", "\\c ");
}

function registerDurationRule(value) {
  const key = String(value).trim();

  if (!key || registeredDurations.has(key)) {
    return;
  }

  /* parseMilliseconds() normalizes invalid input to a safe number. */

  const milliseconds = parseMilliseconds(key, DEFAULT_REVEAL_DURATION);

  const selector = `[data-motion][data-motion-duration="${escapeCssString(
    key,
  )}"]`;

  try {
    const sheet = getRuntimeSheet();

    if (!sheet) {
      return;
    }

    sheet.insertRule(
      `${selector} { ` +
        `--motion-duration: ${milliseconds}ms; ` +
        `--motion-text-duration: ${milliseconds}ms; ` +
        `}`,
      sheet.cssRules.length,
    );

    registeredDurations.add(key);
  } catch {
    /* A malformed value must never break Motion; SCSS timing remains. */
  }
}

function applyElementConfiguration(element, type) {
  if (element.dataset.motionDuration !== undefined && type !== "type") {
    registerDurationRule(element.dataset.motionDuration);
  }
}

/* ==========================================================================
   Groups
   ========================================================================== */

/**
 * The group that owns an element, never the element itself.
 */

function getOwningGroup(element) {
  return element.parentElement?.closest(GROUP_SELECTOR) ?? null;
}

/**
 * The group this element is a stagger item of, or null.
 *
 * Only top-level items count. A Motion element nested inside another item
 * (e.g. a typing input inside a revealed card) keeps its own delay.
 */

function getItemGroup(element) {
  const group = getOwningGroup(element);

  if (!group) {
    return null;
  }

  const parentMotion = element.parentElement?.closest(MOTION_SELECTOR);

  const nested =
    parentMotion && parentMotion !== group && group.contains(parentMotion);

  return nested ? null : group;
}

/**
 * Numeric attributes are read directly; presets come from the SCSS tokens.
 */

function getGroupStagger(group) {
  const value = group.dataset.motionStagger;

  if (value && !PRESETS.has(value)) {
    return parseMilliseconds(value, DEFAULT_GROUP_STAGGER);
  }

  return readCssMilliseconds(group, "--motion-stagger", DEFAULT_GROUP_STAGGER);
}

function getGroupDelay(group) {
  const value = group.dataset.motionGroupDelay;

  if (value !== undefined) {
    return parseMilliseconds(value);
  }

  return readCssMilliseconds(group, "--motion-group-delay", 0);
}

/**
 * Motion items owned by this group. Nested groups own their own items.
 */

function getGroupItems(group) {
  return Array.from(group.querySelectorAll(MOTION_SELECTOR)).filter(
    (element) => getItemGroup(element) === group,
  );
}

/**
 * Only items that have not started are (re)indexed, so items inserted
 * later stagger among themselves instead of inheriting a long delay from
 * their position in the whole group.
 */

function applyGroupTiming(group) {
  const stagger = getGroupStagger(group);

  const groupDelay = getGroupDelay(group);

  getGroupItems(group)
    .filter((element) => getMotionType(element) && !hasStarted(element))
    .forEach((element, index) => {
      elementDelays.set(
        element,
        groupDelay + index * stagger + getManualDelay(element),
      );
    });
}

function initializeGroup(group) {
  if (!isElement(group) || initializedGroups.has(group)) {
    return;
  }

  initializedGroups.add(group);

  applyGroupTiming(group);
}

function initializeGroups(scope = document) {
  if (isElement(scope) && scope.matches(GROUP_SELECTOR)) {
    initializeGroup(scope);
  }

  scope.querySelectorAll?.(GROUP_SELECTOR).forEach(initializeGroup);
}

function refreshGroup(group) {
  if (isElement(group)) {
    applyGroupTiming(group);
  }
}

/* ==========================================================================
   Text Segmentation
   ========================================================================== */

function getElementLanguage(element) {
  return (
    element.closest("[lang]")?.lang ||
    document.documentElement.lang ||
    undefined
  );
}

/**
 * One Intl.Segmenter per language. An invalid language tag or a missing
 * Intl.Segmenter falls back to code points.
 */

function getSegmenter(language) {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return null;
  }

  const key = language ?? "";

  if (!segmenters.has(key)) {
    try {
      segmenters.set(
        key,
        new Intl.Segmenter(language, { granularity: "grapheme" }),
      );
    } catch {
      segmenters.set(key, null);
    }
  }

  return segmenters.get(key);
}

function segmentGraphemes(element, text) {
  const segmenter = getSegmenter(getElementLanguage(element));

  if (!segmenter) {
    /* Code points: never splits UTF-16 surrogate pairs. */

    return Array.from(text);
  }

  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

function segmentWords(text) {
  return text.split(/(\s+)/u).filter((segment) => segment !== "");
}

/**
 * Character reveal on joined scripts (Arabic etc.) would render isolated
 * letter forms, so those hosts animate by word instead.
 */

function resolveUnitMode(type, text) {
  return type === "chars" && CONNECTED_SCRIPT.test(text) ? "words" : type;
}

/* ==========================================================================
   Text DOM
   ========================================================================== */

function createSpan(className, text = "") {
  const span = document.createElement("span");

  span.className = className;

  if (text) {
    span.textContent = text;
  }

  return span;
}

function createHiddenSpan(className, text = "") {
  const span = createSpan(className, text);

  span.setAttribute("aria-hidden", "true");

  return span;
}

/**
 * Screen readers get one clean copy through .motion-text__sr (aria-label is
 * ignored on <p> and generic elements). An author aria-label is respected.
 */

function mountTextLayers(element, text, layers) {
  const children = [];

  if (!element.hasAttribute("aria-label")) {
    children.push(createSpan("motion-text__sr", text));
  }

  children.push(...layers);

  element.replaceChildren(...children);

  element.classList.add("is-motion-enhanced");
}

/* ==========================================================================
   Word / Character Preparation
   ========================================================================== */

function prepareUnitText(element, type, text) {
  const mode = resolveUnitMode(type, text);

  const segments =
    mode === "chars" ? segmentGraphemes(element, text) : segmentWords(text);

  const visual = createHiddenSpan("motion-text__visual");

  const units = [];

  segments.forEach((segment) => {
    /* Whitespace stays a plain text node so it never animates alone. */

    if (/^\s+$/u.test(segment)) {
      visual.append(document.createTextNode(segment));

      return;
    }

    const unit = createSpan("motion-text__unit", segment);

    units.push(unit);

    visual.append(unit);
  });

  mountTextLayers(element, text, [visual]);

  return {
    units,
    unitFrame: null,
  };
}

/* ==========================================================================
   Typing Preparation
   ========================================================================== */

/**
 * The ghost holds the full text invisibly and reserves the final size.
 * The visual layer sits on top (same grid cell) and receives the typing.
 * The caret lives inside the visual layer so it follows the last character.
 */

function prepareTypingText(element, text) {
  const ghost = createHiddenSpan("motion-text__ghost", text);

  const visual = createHiddenSpan("motion-text__visual");

  const typed = document.createTextNode("");

  const caret = createHiddenSpan("motion-text__caret");

  visual.append(typed, caret);

  mountTextLayers(element, text, [ghost, visual]);

  return {
    typed,

    graphemes: segmentGraphemes(element, text),

    typingIndex: 0,
    typingTimer: null,
    typingRunning: false,
  };
}

/* ==========================================================================
   Text Element Preparation
   ========================================================================== */

function initializeTextElement(element, type) {
  /*
   * Plain-text hosts only. Rich markup is never split, because that could
   * remove links, inline semantics or component structure.
   */

  if (element.childElementCount > 0) {
    return false;
  }

  /* Collapse source indentation so typing never "types" invisible space. */

  const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();

  if (!text) {
    return false;
  }

  const prepared =
    type === "type"
      ? prepareTypingText(element, text)
      : prepareUnitText(element, type, text);

  elementStates.set(element, {
    type,
    text,

    completionTimer: null,

    ...prepared,
  });

  return true;
}

/* ==========================================================================
   Text Timing
   ========================================================================== */

function getTextStagger(element) {
  return readCssMilliseconds(
    element,
    "--motion-text-stagger",
    DEFAULT_TEXT_STAGGER,
  );
}

function getTypingSpeed(element) {
  const value = element.dataset.motionSpeed;

  if (value && !PRESETS.has(value)) {
    return Math.max(1, parseMilliseconds(value, TYPING_SPEEDS.normal));
  }

  return TYPING_SPEEDS[value] ?? TYPING_SPEEDS.normal;
}

function getTypingPause(grapheme, speed) {
  if (SENTENCE_END.test(grapheme)) {
    return speed * SENTENCE_PAUSE;
  }

  if (CLAUSE_END.test(grapheme)) {
    return speed * CLAUSE_PAUSE;
  }

  return speed;
}

/* ==========================================================================
   Completion
   ========================================================================== */

/**
 * .is-motion-complete releases every motion style, handing the element back
 * to its component's own styles and interaction states.
 */

function clearCompletionTimer(element) {
  const state = elementStates.get(element);

  if (!state || state.completionTimer === null) {
    return;
  }

  window.clearTimeout(state.completionTimer);

  state.completionTimer = null;
}

function scheduleCompletion(element, milliseconds) {
  const state = getState(element);

  clearCompletionTimer(element);

  state.completionTimer = window.setTimeout(() => {
    state.completionTimer = null;

    element.classList.add("is-motion-complete");
  }, milliseconds + COMPLETION_BUFFER);
}

/**
 * Measured from the moment the element starts. The JavaScript delay has
 * already elapsed; an author --motion-delay in CSS is still included.
 */

function getRevealCompletionTime(element) {
  return (
    readCssMilliseconds(element, "--motion-duration", DEFAULT_REVEAL_DURATION) +
    readCssMilliseconds(element, "--motion-delay", 0)
  );
}

/* ==========================================================================
   Delayed Start
   ========================================================================== */

function clearStartTimer(element) {
  const timer = startTimers.get(element);

  if (timer === undefined) {
    return;
  }

  window.clearTimeout(timer);

  startTimers.delete(element);
}

/**
 * Runs `start` after the resolved delay. The element stays in its hidden
 * CSS state until then, so no inline transition-delay is needed.
 */

function startAfterDelay(element, start) {
  clearStartTimer(element);

  const delay = getDelay(element);

  if (delay <= 0) {
    start();

    return;
  }

  const timer = window.setTimeout(() => {
    startTimers.delete(element);

    /* The preference may have changed while waiting. */

    if (!canAnimate()) {
      completeMotionElement(element);

      return;
    }

    start();
  }, delay);

  startTimers.set(element, timer);
}

/* ==========================================================================
   Unit Runtime — Words / Characters
   ========================================================================== */

/**
 * Units enter one by one by receiving .is-motion-in. One animation-frame
 * loop exists only while units still need to enter.
 */

function stopUnits(state) {
  if (state.unitFrame) {
    window.cancelAnimationFrame(state.unitFrame);
  }

  state.unitFrame = null;
}

function showAllUnits(element) {
  const state = elementStates.get(element);

  if (!state?.units) {
    return;
  }

  stopUnits(state);

  state.units.forEach((unit) => {
    unit.classList.add("is-motion-in");
  });
}

function resetUnits(element) {
  const state = elementStates.get(element);

  if (!state?.units) {
    return;
  }

  stopUnits(state);

  state.units.forEach((unit) => {
    unit.classList.remove("is-motion-in");
  });
}

function revealUnits(element) {
  const state = elementStates.get(element);

  if (!state?.units) {
    return;
  }

  stopUnits(state);

  const stagger = getTextStagger(element);

  const duration = readCssMilliseconds(
    element,
    "--motion-text-duration",
    DEFAULT_TEXT_DURATION,
  );

  let next = 0;
  let startTime = null;

  const tick = (now) => {
    if (!canAnimate()) {
      completeMotionElement(element);

      return;
    }

    startTime ??= now;

    const elapsed = now - startTime;

    while (next < state.units.length && elapsed >= next * stagger) {
      state.units[next].classList.add("is-motion-in");

      next += 1;
    }

    if (next < state.units.length) {
      state.unitFrame = window.requestAnimationFrame(tick);

      return;
    }

    state.unitFrame = null;

    scheduleCompletion(element, duration);
  };

  state.unitFrame = window.requestAnimationFrame(tick);
}

/* ==========================================================================
   Typing Runtime
   ========================================================================== */

function stopTyping(state) {
  if (state.typingTimer !== null) {
    window.clearTimeout(state.typingTimer);
  }

  state.typingTimer = null;
  state.typingRunning = false;
}

function finishTyping(element) {
  const state = elementStates.get(element);

  if (state?.type !== "type") {
    return;
  }

  stopTyping(state);

  state.typed.data = state.text;

  state.typingIndex = state.graphemes.length;

  element.classList.add("is-motion-visible", "is-motion-complete");
}

function startTyping(element) {
  const state = elementStates.get(element);

  if (state?.type !== "type" || state.typingRunning) {
    return;
  }

  if (!canAnimate()) {
    finishTyping(element);

    return;
  }

  const speed = getTypingSpeed(element);

  state.typingRunning = true;
  state.typingIndex = 0;
  state.typed.data = "";

  element.classList.add("is-motion-visible");

  element.classList.remove("is-motion-complete");

  const step = () => {
    if (!state.typingRunning) {
      return;
    }

    if (!canAnimate()) {
      finishTyping(element);

      return;
    }

    if (state.typingIndex >= state.graphemes.length) {
      stopTyping(state);

      element.classList.add("is-motion-complete");

      return;
    }

    const grapheme = state.graphemes[state.typingIndex];

    /* One text node, so joined scripts keep shaping while typing. */

    state.typed.appendData(grapheme);

    state.typingIndex += 1;

    state.typingTimer = window.setTimeout(
      step,
      getTypingPause(grapheme, speed),
    );
  };

  /* Typing owns its start timer: every later character also uses timers. */

  const delay = getDelay(element);

  if (delay <= 0) {
    step();

    return;
  }

  state.typingTimer = window.setTimeout(step, delay);
}

function resetTyping(element) {
  const state = elementStates.get(element);

  if (state?.type !== "type") {
    return;
  }

  stopTyping(state);

  state.typingIndex = 0;
  state.typed.data = "";

  element.classList.remove("is-motion-visible", "is-motion-complete");
}

/* ==========================================================================
   Placeholder Runtime
   ========================================================================== */

/**
 * data-motion="placeholder" types the placeholder of an <input>/<textarea>.
 *
 *   <input
 *     aria-label="Search"
 *     placeholder="Search markets…"
 *     data-motion="placeholder"
 *     data-motion-placeholders="Search stocks…|Search sectors…|Search markets…"
 *     data-motion-loop
 *   />
 *
 * Options
 *   data-motion-placeholders  phrases separated by "|" (default: placeholder)
 *   data-motion-loop          cycle forever (default: play once)
 *   data-motion-speed         fast | normal | slow | ms per character
 *   data-motion-hold          ms a finished phrase stays visible
 *   data-motion-delay         ms before typing starts
 *
 * Once mode types the phrases in sequence and rests on the last one.
 * Loop mode types → holds → deletes → next phrase → repeats.
 *
 * The authored placeholder is the resting content: shown without
 * JavaScript, with reduced motion, when the user takes over, and in static
 * mode.
 *
 * Skipped (stays static):
 *   - disabled or read-only fields;
 *   - floating-label fields (the component owns placeholder visibility);
 *   - fields without an accessible name, because the placeholder would be
 *     their name and screen readers would hear it change constantly.
 *
 * Performance: one timer per active field, no animation-frame loop, no
 * layout reads while typing; paused off screen, in hidden tabs and while
 * the user is in the field.
 */

const PLACEHOLDER_SKIP_SELECTOR = ".form-floating";

const PLACEHOLDER_HOLD = 2000;
const PLACEHOLDER_GAP = 400;

const PLACEHOLDER_DELETE_RATIO = 0.45;

const PLACEHOLDER_MIN_DELETE_SPEED = 18;

const PLACEHOLDER_JITTER = 0.15;

/*
 * Placeholders currently participating in animation, including paused
 * looping ones, so tab visibility changes can resume them.
 */

const activePlaceholders = new Set();

function isPlaceholderLoop(element) {
  const value = element.dataset.motionLoop;

  return value !== undefined && value !== "false";
}

function hasAccessibleName(element) {
  return (
    element.hasAttribute("aria-label") ||
    element.hasAttribute("aria-labelledby") ||
    element.hasAttribute("title") ||
    (element.labels?.length ?? 0) > 0
  );
}

function normalizePhrase(text) {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Slight timing variation makes placeholder typing feel less mechanical.
 */

function withJitter(milliseconds) {
  const factor = 1 + (Math.random() * 2 - 1) * PLACEHOLDER_JITTER;

  return Math.round(milliseconds * factor);
}

/**
 * An empty placeholder changes :placeholder-shown. One space is used for
 * empty frames so dependent component styles never flip mid-animation.
 */

function setPlaceholder(state, text) {
  const value = text === "" ? " " : text;

  if (state.element.placeholder !== value) {
    state.element.placeholder = value;
  }
}

function getCurrentPhrase(state) {
  return state.phrases[state.phraseIndex];
}

function renderPlaceholder(state) {
  setPlaceholder(
    state,
    getCurrentPhrase(state).slice(0, state.charIndex).join(""),
  );
}

function isLastPhrase(state) {
  return state.phraseIndex === state.phrases.length - 1;
}

/* --------------------------------------------------------------------------
   Timer
   -------------------------------------------------------------------------- */

function clearPlaceholderTimer(state) {
  if (state.timer === null) {
    return;
  }

  window.clearTimeout(state.timer);

  state.timer = null;
}

function schedulePlaceholder(state, milliseconds) {
  clearPlaceholderTimer(state);

  if (state.pauses.size > 0 || state.phase === "done") {
    return;
  }

  if (!canAnimate()) {
    finishPlaceholder(state.element);

    return;
  }

  state.timer = window.setTimeout(() => {
    state.timer = null;

    if (!canAnimate()) {
      finishPlaceholder(state.element);

      return;
    }

    stepPlaceholder(state);
  }, milliseconds);
}

/* --------------------------------------------------------------------------
   Lifecycle
   -------------------------------------------------------------------------- */

function markPlaceholderStarted(state) {
  if (state.started) {
    return;
  }

  state.started = true;

  activePlaceholders.add(state);

  state.element.classList.add("is-motion-visible");
}

/**
 * Natural end of once mode: the final phrase stays visible.
 */

function completePlaceholder(state) {
  clearPlaceholderTimer(state);

  state.phase = "done";

  activePlaceholders.delete(state);

  state.element.classList.add("is-motion-visible", "is-motion-complete");
}

/**
 * Immediate finalization: always restores the authored resting placeholder.
 */

function finishPlaceholder(element) {
  const state = elementStates.get(element);

  if (state?.type !== "placeholder") {
    return;
  }

  clearPlaceholderTimer(state);

  setPlaceholder(state, state.resting);

  completePlaceholder(state);
}

function stepPlaceholder(state) {
  if (!state.element.isConnected) {
    clearPlaceholderTimer(state);

    activePlaceholders.delete(state);

    return;
  }

  if (!canAnimate()) {
    finishPlaceholder(state.element);

    return;
  }

  const phrase = getCurrentPhrase(state);

  if (state.phase === "typing") {
    state.charIndex += 1;

    renderPlaceholder(state);

    if (state.charIndex < phrase.length) {
      schedulePlaceholder(
        state,
        withJitter(getTypingPause(phrase[state.charIndex - 1], state.speed)),
      );

      return;
    }

    if (!state.loop && isLastPhrase(state)) {
      completePlaceholder(state);

      return;
    }

    /* Hold the completed phrase before deleting. */

    state.phase = "deleting";

    schedulePlaceholder(state, state.hold);

    return;
  }

  if (state.phase === "deleting") {
    state.charIndex -= 1;

    renderPlaceholder(state);

    if (state.charIndex > 0) {
      schedulePlaceholder(state, state.deleteSpeed);

      return;
    }

    state.phraseIndex = (state.phraseIndex + 1) % state.phrases.length;

    state.phase = "typing";

    schedulePlaceholder(state, PLACEHOLDER_GAP);
  }
}

/**
 * The right delay when a paused placeholder continues from where it was.
 */

function getResumeDelay(state) {
  const phrase = getCurrentPhrase(state);

  if (state.phase === "deleting" && state.charIndex === phrase.length) {
    return state.hold;
  }

  if (state.phase === "typing" && state.charIndex === 0) {
    return PLACEHOLDER_GAP;
  }

  return state.phase === "deleting" ? state.deleteSpeed : state.speed;
}

/* --------------------------------------------------------------------------
   Pause / Resume
   -------------------------------------------------------------------------- */

function pausePlaceholder(state, reason) {
  state.pauses.add(reason);

  clearPlaceholderTimer(state);
}

function resumePlaceholder(state, reason) {
  const wasPaused = state.pauses.delete(reason);

  /* Already running: never restart or duplicate the timer. */

  if (!wasPaused && state.timer !== null) {
    return;
  }

  if (!state.started || state.phase === "done" || state.pauses.size > 0) {
    return;
  }

  if (!canAnimate()) {
    finishPlaceholder(state.element);

    return;
  }

  schedulePlaceholder(state, getResumeDelay(state));
}

/* --------------------------------------------------------------------------
   Start
   -------------------------------------------------------------------------- */

function startPlaceholder(element) {
  const state = elementStates.get(element);

  if (state?.type !== "placeholder" || state.phase === "done") {
    return;
  }

  /* Entering the viewport clears the offscreen pause. */

  state.pauses.delete("offscreen");

  if (!canAnimate()) {
    finishPlaceholder(element);

    return;
  }

  /* An already started placeholder resumes rather than restarting. */

  if (state.started) {
    resumePlaceholder(state, "offscreen");

    return;
  }

  markPlaceholderStarted(state);

  state.phase = "typing";
  state.phraseIndex = 0;
  state.charIndex = 0;

  setPlaceholder(state, "");

  schedulePlaceholder(state, getDelay(element));
}

/**
 * Returns a finished placeholder to its starting state so it can play
 * again. Skipped while the visitor is using the field or has typed in it.
 */

function rearmPlaceholder(element) {
  const state = elementStates.get(element);

  if (
    state?.type !== "placeholder" ||
    document.activeElement === element ||
    element.value !== ""
  ) {
    return false;
  }

  clearPlaceholderTimer(state);

  activePlaceholders.delete(state);

  state.phase = "idle";
  state.started = false;
  state.phraseIndex = 0;
  state.charIndex = 0;

  state.pauses.clear();

  element.classList.remove("is-motion-visible", "is-motion-complete");

  setPlaceholder(state, "");

  return true;
}

/* --------------------------------------------------------------------------
   User Takeover
   -------------------------------------------------------------------------- */

function handlePlaceholderFocus(state) {
  if (state.phase === "done") {
    return;
  }

  /* Once mode: interaction permanently finishes the decoration. */

  if (!state.loop) {
    finishPlaceholder(state.element);

    return;
  }

  /*
   * Loop mode: pause while the user owns the field, showing the full
   * current phrase rather than a partially typed hint.
   */

  markPlaceholderStarted(state);

  pausePlaceholder(state, "user");

  state.charIndex = getCurrentPhrase(state).length;

  state.phase = "deleting";

  renderPlaceholder(state);
}

function handlePlaceholderBlur(state) {
  if (state.phase === "done" || state.element.value !== "") {
    return;
  }

  resumePlaceholder(state, "user");
}

/* --------------------------------------------------------------------------
   Page Visibility
   -------------------------------------------------------------------------- */

function handleVisibilityChange() {
  const hidden = document.visibilityState === "hidden";

  activePlaceholders.forEach((state) => {
    if (!state.element.isConnected) {
      clearPlaceholderTimer(state);

      activePlaceholders.delete(state);

      return;
    }

    if (hidden) {
      pausePlaceholder(state, "tab");

      return;
    }

    resumePlaceholder(state, "tab");
  });
}

/* --------------------------------------------------------------------------
   Preparation
   -------------------------------------------------------------------------- */

function initializePlaceholderElement(element) {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return false;
  }

  if (
    element.disabled ||
    element.readOnly ||
    element.closest(PLACEHOLDER_SKIP_SELECTOR) ||
    !hasAccessibleName(element)
  ) {
    return false;
  }

  const attribute = normalizePhrase(element.getAttribute("placeholder") ?? "");

  const listed = (element.dataset.motionPlaceholders ?? "")
    .split("|")
    .map(normalizePhrase)
    .filter(Boolean);

  const texts = listed.length > 0 ? listed : [attribute].filter(Boolean);

  if (texts.length === 0) {
    return false;
  }

  const loop = isPlaceholderLoop(element);

  const speed = getTypingSpeed(element);

  const state = {
    type: "placeholder",
    element,

    phrases: texts.map((text) => segmentGraphemes(element, text)),

    /* Prefer the authored placeholder; otherwise a meaningful phrase. */

    resting: attribute || (loop ? texts[0] : texts[texts.length - 1]),

    loop,

    speed,

    deleteSpeed: Math.max(
      PLACEHOLDER_MIN_DELETE_SPEED,
      Math.round(speed * PLACEHOLDER_DELETE_RATIO),
    ),

    hold: parseMilliseconds(element.dataset.motionHold, PLACEHOLDER_HOLD),

    phase: "idle",
    phraseIndex: 0,
    charIndex: 0,

    timer: null,
    started: false,

    pauses: new Set(),

    completionTimer: null,
  };

  elementStates.set(element, state);

  element.addEventListener("focus", () => handlePlaceholderFocus(state));

  element.addEventListener("blur", () => handlePlaceholderBlur(state));

  /* Start visually empty only when motion will genuinely run. */

  setPlaceholder(state, canAnimate() ? "" : state.resting);

  /* Autofocused field: the user already owns it. */

  if (document.activeElement === element) {
    handlePlaceholderFocus(state);
  }

  return true;
}

/* ==========================================================================
   Final State
   ========================================================================== */

/**
 * Immediately places an initialized element in its final visible state.
 * Used whenever motion must not run, and when an element is removed.
 */

function completeMotionElement(element) {
  const type = getMotionType(element);

  if (!type) {
    return;
  }

  clearStartTimer(element);
  clearCompletionTimer(element);

  if (type === "type") {
    finishTyping(element);

    return;
  }

  if (type === "placeholder") {
    finishPlaceholder(element);

    return;
  }

  showAllUnits(element);

  element.classList.add("is-motion-visible", "is-motion-complete");
}

/**
 * Resolves every initialized element to its final visible state.
 */

function revealAll() {
  document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
    if (initializedElements.has(element)) {
      completeMotionElement(element);
    }
  });
}

/* ==========================================================================
   Show / Hide
   ========================================================================== */

function showMotionElement(element) {
  const type = getMotionType(element);

  if (!type) {
    return;
  }

  if (!canAnimate()) {
    completeMotionElement(element);

    return;
  }

  if (type === "placeholder") {
    startPlaceholder(element);

    return;
  }

  /* Never restart an element that is already visible or about to start. */

  if (hasStarted(element)) {
    return;
  }

  if (type === "type") {
    startTyping(element);

    return;
  }

  startAfterDelay(element, () => {
    element.classList.add("is-motion-visible");

    element.classList.remove("is-motion-complete");

    if (type === "reveal") {
      scheduleCompletion(element, getRevealCompletionTime(element));

      return;
    }

    revealUnits(element);
  });
}

/**
 * Repeat mode only. The hidden state has no transition, so leaving the
 * viewport resets instantly without playing in reverse.
 */

function hideMotionElement(element) {
  const type = getMotionType(element);

  if (!type) {
    return;
  }

  if (!canAnimate()) {
    completeMotionElement(element);

    return;
  }

  /* Looping placeholders pause off screen instead of resetting. */

  if (type === "placeholder") {
    const state = elementStates.get(element);

    if (state) {
      pausePlaceholder(state, "offscreen");
    }

    return;
  }

  clearStartTimer(element);
  clearCompletionTimer(element);

  if (type === "type") {
    resetTyping(element);

    return;
  }

  resetUnits(element);

  element.classList.remove("is-motion-visible", "is-motion-complete");
}

/**
 * Returns a finished element to its hidden starting state and observes it
 * again, so it animates the next time it enters the viewport.
 *
 * Only called for elements that are off screen: the reset is instant (the
 * hidden state has no transition) and the visitor never sees it.
 */

function rearmMotionElement(element) {
  const type = getMotionType(element);

  if (!type) {
    return;
  }

  clearStartTimer(element);
  clearCompletionTimer(element);

  if (type === "placeholder") {
    if (!rearmPlaceholder(element)) {
      return;
    }
  } else if (type === "type") {
    resetTyping(element);
  } else {
    resetUnits(element);

    element.classList.remove("is-motion-visible", "is-motion-complete");
  }

  observeMotionElement(element);
}

/* ==========================================================================
   Intersection
   ========================================================================== */

/**
 * Two observer roles:
 *
 * - Enter observers (pooled; default 12% bottom margin) start elements.
 * - One exit observer (no margin) resets repeat-mode elements only when
 *   they are fully outside the real viewport.
 *
 * Keeping the roles separate means an element sitting in the bottom 12% of
 * the screen is never reset while the visitor can still see it.
 */

/**
 * Elements taller than the root cannot reach a large intersection ratio,
 * so for them entering the viewport is enough.
 */

function meetsThreshold(entry, threshold) {
  if (!entry.isIntersecting) {
    return false;
  }

  if (entry.intersectionRatio >= threshold) {
    return true;
  }

  const rootHeight = entry.rootBounds?.height ?? window.innerHeight;

  return entry.boundingClientRect.height * threshold >= rootHeight;
}

function handleEnter(entries, observer) {
  entries.forEach((entry) => {
    const element = entry.target;

    if (!meetsThreshold(entry, getThreshold(element))) {
      return;
    }

    showMotionElement(element);

    if (shouldRunOnce(element)) {
      observer.unobserve(element);
    }
  });
}

function handleExit(entries) {
  entries.forEach((entry) => {
    if (entry.isIntersecting || shouldRunOnce(entry.target)) {
      return;
    }

    hideMotionElement(entry.target);
  });
}

function getEnterObserver(element) {
  if (runtimeMode !== "enabled") {
    return null;
  }

  const threshold = getThreshold(element);

  const rootMargin = getRootMargin(element);

  const key = `${threshold}|${rootMargin}`;

  if (!observerPool.has(key)) {
    try {
      observerPool.set(
        key,
        new IntersectionObserver(handleEnter, {
          threshold: threshold > 0 ? [0, threshold] : [0],
          rootMargin,
        }),
      );
    } catch {
      /* An invalid rootMargin must never leave content hidden. */

      return null;
    }
  }

  return observerPool.get(key);
}

function getExitObserver() {
  if (runtimeMode !== "enabled") {
    return null;
  }

  exitObserver ??= new IntersectionObserver(handleExit, {
    threshold: [0],
  });

  return exitObserver;
}

function observeMotionElement(element) {
  const observer = getEnterObserver(element);

  if (!observer) {
    completeMotionElement(element);

    return;
  }

  observer.observe(element);

  if (!shouldRunOnce(element)) {
    getExitObserver()?.observe(element);
  }
}

function unobserveMotionElement(element) {
  observerPool.forEach((observer) => {
    observer.unobserve(element);
  });

  exitObserver?.unobserve(element);
}

function disconnectObservers() {
  observerPool.forEach((observer) => {
    observer.disconnect();
  });

  observerPool.clear();

  exitObserver?.disconnect();

  exitObserver = null;
}

/* ==========================================================================
   Element Initialization
   ========================================================================== */

function initializeMotionElement(element, { observe = true } = {}) {
  if (!isElement(element) || initializedElements.has(element)) {
    return;
  }

  const type = getMotionType(element);

  if (!type) {
    return;
  }

  applyElementConfiguration(element, type);

  if (type === "placeholder" && !initializePlaceholderElement(element)) {
    return;
  }

  if (TEXT_TYPES.has(type) && !initializeTextElement(element, type)) {
    return;
  }

  initializedElements.add(element);

  if (!canAnimate()) {
    completeMotionElement(element);

    return;
  }

  if (observe) {
    observeMotionElement(element);
  }
}

function initializeMotionElements(scope = document, options = {}) {
  if (isElement(scope) && scope.matches(MOTION_SELECTOR)) {
    initializeMotionElement(scope, options);
  }

  scope.querySelectorAll?.(MOTION_SELECTOR).forEach((element) => {
    initializeMotionElement(element, options);
  });
}

/* ==========================================================================
   Page Readiness
   ========================================================================== */

/**
 * Waits for web fonts, capped so a slow or failing font never delays
 * Motion for long. A rejected font promise is treated as ready.
 */

function whenPageReady() {
  const fontsReady = Promise.resolve(document.fonts?.ready).catch(() => {});

  const timeout = new Promise((resolve) => {
    window.setTimeout(resolve, PAGE_READY_MAX_WAIT);
  });

  return Promise.race([fontsReady, timeout]);
}

/**
 * Two frames guarantee the hidden starting state has painted before
 * on-screen elements transition in.
 *
 * Elements already on screen start directly (this also covers content in
 * the bottom 12% of a page too short to scroll). Everything else, and every
 * repeat-mode element, is observed.
 */

function activateInitialMotion() {
  if (!canAnimate()) {
    revealAll();

    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!canAnimate()) {
        revealAll();

        return;
      }

      document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
        if (!initializedElements.has(element)) {
          return;
        }

        const visibleNow = isInViewport(element);

        if (visibleNow) {
          showMotionElement(element);
        }

        if (!visibleNow || !shouldRunOnce(element)) {
          observeMotionElement(element);
        }
      });
    });
  });
}

/**
 * Late start: the visitor may already be reading. Content currently on
 * screen is finalized as-is; everything below the fold still animates.
 * Placeholders are excluded because typing them never hides content.
 */

function completeVisibleElements() {
  document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
    if (
      initializedElements.has(element) &&
      getMotionType(element) !== "placeholder" &&
      isInViewport(element)
    ) {
      completeMotionElement(element);
    }
  });
}

/* ==========================================================================
   Preference Changes
   ========================================================================== */

/**
 * Applied live; no page refresh is needed in either direction.
 *
 * Reduce: stop observing, cancel running motion, show final content.
 *
 * Back to normal:
 *   - elements on screen stay exactly as they are (content never
 *     disappears in front of the visitor); repeat-mode ones are observed
 *     again so they replay after leaving the viewport;
 *   - elements off screen are re-armed and animate when scrolled to;
 *   - group staggers are recalculated for the re-armed items.
 */

function handleMotionPreferenceChange() {
  if (!canAnimate()) {
    disconnectObservers();

    revealAll();

    return;
  }

  document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
    if (!initializedElements.has(element)) {
      return;
    }

    if (isInViewport(element)) {
      if (!shouldRunOnce(element)) {
        observeMotionElement(element);
      }

      return;
    }

    rearmMotionElement(element);
  });

  document.querySelectorAll(GROUP_SELECTOR).forEach(refreshGroup);
}

function observeSiteMotionPreference() {
  preferenceObserver = new MutationObserver(handleMotionPreferenceChange);

  preferenceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [PREFERENCE_ATTRIBUTE],
  });
}

/* ==========================================================================
   Public Refresh
   ========================================================================== */

/**
 * Initializes Motion markup inserted after page load.
 *
 * Called automatically for DOM mutations; also available to modules that
 * render Motion markup deliberately.
 *
 * @param {Document | DocumentFragment | HTMLElement} scope
 */

export function refreshMotion(scope = document) {
  initializeGroups(scope);

  initializeMotionElements(scope, {
    observe: true,
  });

  if (isElement(scope)) {
    const owningGroup = scope.closest(GROUP_SELECTOR);

    if (owningGroup) {
      refreshGroup(owningGroup);
    }
  }
}

/* ==========================================================================
   Dynamic DOM
   ========================================================================== */

/**
 * Only nodes that are, or contain, Motion markup are processed. The spans
 * Motion creates while enhancing text are ignored.
 */

function containsMotion(node) {
  if (!isElement(node)) {
    return false;
  }

  return (
    node.matches(ANY_MOTION_SELECTOR) ||
    node.querySelector(ANY_MOTION_SELECTOR) !== null
  );
}

function collectMotionElements(node) {
  const elements = Array.from(node.querySelectorAll(MOTION_SELECTOR));

  if (node.matches(MOTION_SELECTOR)) {
    elements.unshift(node);
  }

  return elements;
}

/**
 * Removed elements stop being observed and have their timers cancelled.
 * They are left in their final visible state, so re-inserting one later
 * never shows hidden content.
 *
 * Nodes that were only moved (still connected) are left untouched.
 */

function releaseRemovedMotion(node) {
  if (node.isConnected) {
    return;
  }

  collectMotionElements(node).forEach((element) => {
    if (!initializedElements.has(element)) {
      return;
    }

    unobserveMotionElement(element);

    completeMotionElement(element);
  });
}

function handleMutations(mutations) {
  const removedNodes = new Set();
  const groupsToRefresh = new Set();

  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((node) => {
      if (containsMotion(node)) {
        removedNodes.add(node);
      }
    });

    mutation.addedNodes.forEach((node) => {
      if (!containsMotion(node)) {
        return;
      }

      initializeGroups(node);

      initializeMotionElements(node, {
        observe: true,
      });

      const owningGroup = node.closest(GROUP_SELECTOR);

      if (owningGroup) {
        groupsToRefresh.add(owningGroup);
      }

      node.querySelectorAll(GROUP_SELECTOR).forEach((group) => {
        groupsToRefresh.add(group);
      });
    });
  });

  removedNodes.forEach(releaseRemovedMotion);

  groupsToRefresh.forEach(refreshGroup);
}

function observeDynamicMotion() {
  if (!document.body) {
    return;
  }

  mutationObserver = new MutationObserver(handleMutations);

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initMotion() {
  if (initialized) {
    return;
  }

  initialized = true;

  const root = document.documentElement;

  /* JavaScript arrived: cancel the head bootstrap's safety timer. */

  if (window.__motionFallback !== undefined) {
    window.clearTimeout(window.__motionFallback);
  }

  const bootedLate = window.__motionFallbackFired === true;

  /*
   * Missing infrastructure: fail open. .motion-ready is never added, so
   * SCSS never enters hidden states that JavaScript cannot manage.
   */

  if (!supportsMotionRuntime()) {
    runtimeMode = "static";

    initializeGroups(document);

    initializeMotionElements(document, {
      observe: false,
    });

    return;
  }

  runtimeMode = "enabled";

  /* Group timing must exist before elements run. */

  initializeGroups(document);

  /*
   * Prepare without observing, so no observer callback can reveal content
   * before the hidden starting state receives its first paint.
   */

  initializeMotionElements(document, {
    observe: false,
  });

  if (bootedLate) {
    completeVisibleElements();
  }

  /* Activation gate for the reveal / text SCSS. */

  root.classList.add("motion-ready");

  if (canAnimate()) {
    whenPageReady().then(activateInitialMotion);
  } else {
    revealAll();
  }

  observeDynamicMotion();

  observeSiteMotionPreference();

  /* Looping placeholders stop completely while the tab is hidden. */

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/* ==========================================================================
   Auto Start
   ========================================================================== */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMotion, {
    once: true,
  });
} else {
  initMotion();
}
