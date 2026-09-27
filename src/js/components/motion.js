/* ==========================================================================
   Motion
   ========================================================================== */

/**
 * Progressive-enhancement motion system.
 *
 * Supported modes:
 *
 * - data-motion="reveal"
 * - data-motion="type"
 * - data-motion="words"
 * - data-motion="chars"
 * - data-motion="placeholder"   (inputs / textareas)
 *
 * Design goals:
 *
 * - no scroll listeners (IntersectionObserver only);
 * - content is never lost if JavaScript fails or loads late;
 * - reduced motion respected (OS setting and site setting, live);
 * - RTL handled by SCSS, not runtime direction math;
 * - accessible text animation (screen readers get the full text once);
 * - no layout shift and no layout-property animation.
 *
 * State classes (read by SCSS):
 *
 * - .is-motion-enhanced  text host has been split / prepared;
 * - .is-motion-visible   element has entered and is animating in;
 * - .is-motion-complete  animation finished; motion styles released;
 * - .is-motion-in        (text units) this word / character has entered.
 *
 * Clean DOM: Motion never writes inline `style` attributes. Delays and
 * staggers are scheduled in JavaScript; custom durations become shared,
 * de-duplicated rules in one runtime stylesheet.
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

const MOTION_SELECTOR = "[data-motion]";
const GROUP_SELECTOR = "[data-motion-group]";
const ANY_MOTION_SELECTOR = `${MOTION_SELECTOR}, ${GROUP_SELECTOR}`;

/* ==========================================================================
   Defaults
   ========================================================================== */

/**
 * Elements reveal when their top edge passes 12% above the viewport bottom.
 * Works for any element height, unlike a ratio threshold.
 */

const DEFAULT_THRESHOLD = 0;
const DEFAULT_ROOT_MARGIN = "0px 0px -12% 0px";

/* Fallbacks only; the real values come from the SCSS custom properties. */

const DEFAULT_REVEAL_DURATION = 800;
const DEFAULT_TEXT_DURATION = 650;
const DEFAULT_TEXT_STAGGER = 40;
const DEFAULT_GROUP_STAGGER = 100;

/* Typing: milliseconds per character. */

const TYPING_SPEEDS = {
  fast: 30,
  normal: 45,
  slow: 70,
};

/* Natural pauses after punctuation (multiplier of typing speed). */

const SENTENCE_PAUSE = 8;
const CLAUSE_PAUSE = 4;

const SENTENCE_END = /[.!?؟…]$/u;
const CLAUSE_END = /[,;:،؛]$/u;

/* Small safety margin before releasing motion styles. */

const COMPLETION_BUFFER = 50;

const PRESETS = new Set(["fast", "normal", "slow"]);

const SUPPORTED_TYPES = new Set([
  "reveal",
  "type",
  "words",
  "chars",
  "placeholder",
]);
const TEXT_TYPES = new Set(["type", "words", "chars"]);
const UNIT_TYPES = new Set(["words", "chars"]);

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

/* Runtime stylesheet for custom durations (see registerDurationRule). */

let runtimeSheet = null;

const registeredDurations = new Set();

const observerPool = new Map();

let mutationObserver = null;
let preferenceObserver = null;
let motionMediaQuery = null;

let initialized = false;

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
    state = { completionTimer: null };

    elementStates.set(element, state);
  }

  return state;
}

/**
 * The group that owns an element — never the element itself.
 */

function getOwningGroup(element) {
  return element.parentElement?.closest(GROUP_SELECTOR) ?? null;
}

/**
 * The group this element is a stagger item of, or null.
 *
 * Only top-level items count. A Motion element nested inside another item
 * (e.g. a typing input inside a revealed card) is not staggered separately;
 * it keeps its own data-motion-delay instead.
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

/* ==========================================================================
   Motion Preference
   ========================================================================== */

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    motionMediaQuery?.matches === true
  );
}

/* ==========================================================================
   Motion Type
   ========================================================================== */

/**
 * <html data-motion="normal|reduce"> is the site setting, not a Motion
 * element; it is ignored here because those values are not supported types.
 */

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
 * The element's start delay: group stagger + manual delay for group items,
 * manual delay otherwise.
 */

function getDelay(element) {
  return elementDelays.get(element) ?? getManualDelay(element);
}

/* ==========================================================================
   Runtime Stylesheet
   ========================================================================== */

/**
 * Custom durations (data-motion-duration="400") cannot be expressed in the
 * static SCSS. Instead of inline styles, each distinct value gets one shared
 * rule in a single runtime stylesheet:
 *
 *   [data-motion][data-motion-duration="400"] { --motion-duration: 400ms; … }
 *
 * Ten elements with the same value share one rule; the DOM stays clean.
 */

function getRuntimeSheet() {
  if (runtimeSheet) {
    return runtimeSheet;
  }

  const supportsAdopted =
    "adoptedStyleSheets" in Document.prototype &&
    "replaceSync" in CSSStyleSheet.prototype;

  if (supportsAdopted) {
    runtimeSheet = new CSSStyleSheet();

    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      runtimeSheet,
    ];
  } else {
    const style = document.createElement("style");

    style.dataset.motionRuntime = "";

    document.head.append(style);

    runtimeSheet = style.sheet;
  }

  return runtimeSheet;
}

function registerDurationRule(value) {
  const key = String(value).trim();

  if (!key || registeredDurations.has(key)) {
    return;
  }

  registeredDurations.add(key);

  const milliseconds = parseMilliseconds(key, DEFAULT_REVEAL_DURATION);

  const selector = `[data-motion][data-motion-duration="${CSS.escape(key)}"]`;

  try {
    const sheet = getRuntimeSheet();

    sheet.insertRule(
      `${selector} { --motion-duration: ${milliseconds}ms; --motion-text-duration: ${milliseconds}ms; }`,
      sheet.cssRules.length,
    );
  } catch {
    /* Invalid value: the preset duration simply applies. */
  }
}

/**
 * Read per-element options from data attributes.
 */

function applyElementConfiguration(element, type) {
  if (element.dataset.motionDuration !== undefined && type !== "type") {
    registerDurationRule(element.dataset.motionDuration);
  }
}

/* ==========================================================================
   Group Configuration
   ========================================================================== */

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

function applyGroupTiming(group) {
  const stagger = getGroupStagger(group);
  const groupDelay = getGroupDelay(group);

  getGroupItems(group).forEach((element, index) => {
    const type = getMotionType(element);

    if (!type) {
      return;
    }

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
  if (!isElement(group)) {
    return;
  }

  applyGroupTiming(group);
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

function segmentGraphemes(element, text) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(getElementLanguage(element), {
      granularity: "grapheme",
    });

    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }

  return Array.from(text);
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
 * Replace the host content with the prepared layers.
 *
 * Screen readers get one clean copy of the text through .motion-text__sr
 * (aria-label is ignored on <p> and generic elements). If the author already
 * supplied an aria-label, that is respected instead.
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
    /* Whitespace stays a plain text node so it never animates on its own. */

    if (/^\s+$/u.test(segment)) {
      visual.append(document.createTextNode(segment));

      return;
    }

    const unit = createSpan("motion-text__unit", segment);

    units.push(unit);

    visual.append(unit);
  });

  mountTextLayers(element, text, [visual]);

  return { units };
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
  /* Plain-text hosts only; rich markup is never destructively split. */

  if (element.childElementCount > 0) {
    return false;
  }

  /*
   * Collapse source indentation and line breaks. Without this, typing would
   * "type" the invisible HTML indentation and pause before the first letter.
   */

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
 * to its component (own transitions, hover transforms, etc.).
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
 * Measured from the moment the element starts (its JS delay has passed).
 * A --motion-delay set by an author in CSS is still honored.
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

  if (timer !== undefined) {
    window.clearTimeout(timer);

    startTimers.delete(element);
  }
}

/**
 * Run `start` after the element's delay. The element stays in its hidden
 * CSS state until then, so no transition-delay (and no inline style) is
 * needed.
 */

function startAfterDelay(element, start) {
  clearStartTimer(element);

  const delay = getDelay(element);

  if (delay <= 0) {
    start();

    return;
  }

  startTimers.set(
    element,
    window.setTimeout(() => {
      startTimers.delete(element);

      start();
    }, delay),
  );
}

/* ==========================================================================
   Unit Runtime (words / chars)
   ========================================================================== */

/**
 * Units enter one by one by receiving .is-motion-in. A single animation
 * frame loop runs only while units are still entering, then stops.
 */

function stopUnits(state) {
  if (state.unitFrame) {
    window.cancelAnimationFrame(state.unitFrame);
  }

  state.unitFrame = null;
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

function showAllUnits(element) {
  const state = elementStates.get(element);

  if (!state?.units) {
    return;
  }

  stopUnits(state);

  state.units.forEach((unit) => unit.classList.add("is-motion-in"));
}

function resetUnits(element) {
  const state = elementStates.get(element);

  if (!state?.units) {
    return;
  }

  stopUnits(state);

  state.units.forEach((unit) => unit.classList.remove("is-motion-in"));
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

  if (prefersReducedMotion()) {
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

    if (state.typingIndex >= state.graphemes.length) {
      stopTyping(state);

      element.classList.add("is-motion-complete");

      return;
    }

    const grapheme = state.graphemes[state.typingIndex];

    /* appendData keeps one text node, so joined scripts shape correctly. */

    state.typed.appendData(grapheme);

    state.typingIndex += 1;

    state.typingTimer = window.setTimeout(
      step,
      getTypingPause(grapheme, speed),
    );
  };

  state.typingTimer = window.setTimeout(step, getDelay(element));
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
 * data-motion="placeholder" types the placeholder of an <input> / <textarea>.
 *
 *   <input
 *     aria-label="Search"
 *     placeholder="Search markets…"
 *     data-motion="placeholder"
 *     data-motion-placeholders="Search stocks…|Search sectors…|Search markets…"
 *     data-motion-loop
 *   />
 *
 * Options:
 *
 * - data-motion-placeholders  phrases separated by "|"
 *                             (default: the placeholder attribute);
 * - data-motion-loop          cycle forever (default: play once);
 * - data-motion-speed         fast | normal | slow | ms per character;
 * - data-motion-hold          ms a finished phrase stays (default 2000);
 * - data-motion-delay         ms before typing starts.
 *
 * Once (default): types each phrase in order and stays on the last one.
 * Loop: type → hold → delete → next phrase, forever.
 *
 * The placeholder attribute is the resting text: it shows without
 * JavaScript, under reduced motion, and when the user takes over.
 *
 * Skipped automatically: disabled / read-only fields and fields inside
 * .form-floating (their placeholder is hidden until focus).
 *
 * Performance — the loop costs almost nothing:
 *
 * - one timer per input, no animation frames, no layout reads;
 * - fully paused while off screen, while the tab is hidden, and while the
 *   user is focused on the field; zero timers run in those states.
 *
 * Behavior:
 *
 * - focus stops the animation instantly and shows a complete phrase;
 * - loop mode resumes on blur only if the field is still empty;
 * - once mode never restarts after the user interacts.
 */

/**
 * Fields whose placeholder is hidden by design (floating labels show it only
 * on focus, exactly when typing stops) are left untouched.
 */

const PLACEHOLDER_SKIP_SELECTOR = ".form-floating";

const PLACEHOLDER_HOLD = 2000;
const PLACEHOLDER_GAP = 400;
const PLACEHOLDER_DELETE_RATIO = 0.45;
const PLACEHOLDER_MIN_DELETE_SPEED = 18;
const PLACEHOLDER_JITTER = 0.15;

/* States currently animating or paused mid-animation. */

const activePlaceholders = new Set();

function isPlaceholderLoop(element) {
  const value = element.dataset.motionLoop;

  return value !== undefined && value !== "false";
}

function normalizePhrase(text) {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Slight rhythm variation so typing feels human instead of mechanical.
 */

function withJitter(milliseconds) {
  const factor = 1 + (Math.random() * 2 - 1) * PLACEHOLDER_JITTER;

  return Math.round(milliseconds * factor);
}

/**
 * An empty placeholder turns :placeholder-shown off, which moves floating
 * labels and breaks any style keyed on it. "Empty" is therefore one space.
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

/* ---------- Timer ---------- */

function clearPlaceholderTimer(state) {
  if (state.timer !== null) {
    window.clearTimeout(state.timer);

    state.timer = null;
  }
}

function schedulePlaceholder(state, milliseconds) {
  clearPlaceholderTimer(state);

  if (state.pauses.size > 0 || state.phase === "done") {
    return;
  }

  state.timer = window.setTimeout(() => {
    state.timer = null;

    stepPlaceholder(state);
  }, milliseconds);
}

/* ---------- Lifecycle ---------- */

function markPlaceholderStarted(state) {
  if (state.started) {
    return;
  }

  state.started = true;

  activePlaceholders.add(state);

  state.element.classList.add("is-motion-visible");
}

/**
 * Natural end of once mode: the last phrase stays.
 */

function completePlaceholder(state) {
  clearPlaceholderTimer(state);

  state.phase = "done";

  activePlaceholders.delete(state);

  state.element.classList.add("is-motion-visible", "is-motion-complete");
}

/**
 * Immediate end (reduced motion, user takeover in once mode, late load):
 * show the resting text.
 */

function finishPlaceholder(element) {
  const state = elementStates.get(element);

  if (state?.type !== "placeholder") {
    return;
  }

  setPlaceholder(state, state.resting);

  completePlaceholder(state);
}

function stepPlaceholder(state) {
  if (!state.element.isConnected) {
    clearPlaceholderTimer(state);

    activePlaceholders.delete(state);

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

    /* Hold the finished phrase, then start deleting. */

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
 * The right wait when continuing from the current position.
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

function pausePlaceholder(state, reason) {
  state.pauses.add(reason);

  clearPlaceholderTimer(state);
}

function resumePlaceholder(state, reason) {
  const wasPaused = state.pauses.delete(reason);

  /* Already running: never restart the current step. */

  if (!wasPaused && state.timer !== null) {
    return;
  }

  if (!state.started || state.phase === "done" || state.pauses.size > 0) {
    return;
  }

  schedulePlaceholder(state, getResumeDelay(state));
}

function startPlaceholder(element) {
  const state = elementStates.get(element);

  if (state?.type !== "placeholder" || state.phase === "done") {
    return;
  }

  /* Entering the viewport always clears the off-screen pause. */

  state.pauses.delete("offscreen");

  if (state.started) {
    resumePlaceholder(state, "offscreen");

    return;
  }

  if (prefersReducedMotion()) {
    finishPlaceholder(element);

    return;
  }

  markPlaceholderStarted(state);

  state.phase = "typing";
  state.phraseIndex = 0;
  state.charIndex = 0;

  setPlaceholder(state, "");

  schedulePlaceholder(state, getDelay(element));
}

/* ---------- User takeover ---------- */

function handlePlaceholderFocus(state) {
  if (state.phase === "done") {
    return;
  }

  /* Once mode: the user took over, the animation is finished for good. */

  if (!state.loop) {
    finishPlaceholder(state.element);

    return;
  }

  markPlaceholderStarted(state);

  pausePlaceholder(state, "user");

  /* Never leave a half-typed hint in a focused field. */

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

/* ---------- Tab visibility ---------- */

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
    } else {
      resumePlaceholder(state, "tab");
    }
  });
}

/* ---------- Preparation ---------- */

function initializePlaceholderElement(element) {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return false;
  }

  /* Disabled / read-only fields and floating labels stay static. */

  if (
    element.disabled ||
    element.readOnly ||
    element.closest(PLACEHOLDER_SKIP_SELECTOR)
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

  /* Start empty so the first phrase types in instead of flashing. */

  if (!prefersReducedMotion()) {
    setPlaceholder(state, "");
  }

  /* Autofocused field: the user is already there. */

  if (document.activeElement === element) {
    handlePlaceholderFocus(state);
  }

  return true;
}

/* ==========================================================================
   Show / Hide
   ========================================================================== */

function showMotionElement(element) {
  const type = getMotionType(element);

  if (type === "placeholder") {
    startPlaceholder(element);

    return;
  }

  /* Already shown: never restart (prevents typing re-running mid-view). */

  if (!type || element.classList.contains("is-motion-visible")) {
    return;
  }

  if (type === "type") {
    startTyping(element);

    return;
  }

  if (prefersReducedMotion()) {
    showAllUnits(element);

    element.classList.add("is-motion-visible", "is-motion-complete");

    return;
  }

  /* Pending start: already on its way in. */

  if (startTimers.has(element)) {
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
 * Used by repeat mode only. The reset is instant (SCSS has no transition on
 * the hidden state), so re-entry never plays a reverse animation.
 */

function hideMotionElement(element) {
  const type = getMotionType(element);

  if (!type) {
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

/* ==========================================================================
   Intersection Observer
   ========================================================================== */

function isInViewport(element) {
  const rect = element.getBoundingClientRect();

  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

/**
 * True when the element should reveal.
 *
 * Elements taller than the viewport can never reach a high visibility
 * ratio, so for them simply entering is enough.
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

function handleIntersection(entries, observer) {
  entries.forEach((entry) => {
    const element = entry.target;

    if (meetsThreshold(entry, getThreshold(element))) {
      showMotionElement(element);

      if (shouldRunOnce(element)) {
        observer.unobserve(element);
      }

      return;
    }

    /*
     * Repeat mode resets only once fully out of view — never while the
     * element is still partly visible.
     */

    if (!entry.isIntersecting && !shouldRunOnce(element)) {
      hideMotionElement(element);
    }
  });
}

function getObserver(element) {
  const threshold = getThreshold(element);
  const rootMargin = getRootMargin(element);

  const key = `${threshold}|${rootMargin}`;

  if (!observerPool.has(key)) {
    observerPool.set(
      key,
      new IntersectionObserver(handleIntersection, {
        threshold: threshold > 0 ? [0, threshold] : [0],
        rootMargin,
      }),
    );
  }

  return observerPool.get(key);
}

/* ==========================================================================
   Motion Element Initialization
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

  if (TEXT_TYPES.has(type)) {
    if (!initializeTextElement(element, type)) {
      return;
    }
  }

  initializedElements.add(element);

  if (prefersReducedMotion()) {
    showMotionElement(element);

    return;
  }

  if (observe) {
    getObserver(element).observe(element);
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
   Initial Activation
   ========================================================================== */

/**
 * Wait until the page can actually be seen before the first sequence plays.
 *
 * While web fonts load, browsers keep text invisible for up to ~3s. Without
 * this wait, the entrance animation runs during that invisible period and
 * the visitor only sees the finished result "pop" in.
 *
 * Capped, so a slow or failing font never holds content back for long.
 */

const PAGE_READY_MAX_WAIT = 1200;

function whenPageReady() {
  const fontsReady = document.fonts?.ready ?? Promise.resolve();

  const timeout = new Promise((resolve) => {
    window.setTimeout(resolve, PAGE_READY_MAX_WAIT);
  });

  return Promise.race([fontsReady, timeout]);
}

/**
 * Two animation frames guarantee the hidden starting state has been painted
 * before above-the-fold elements move to their visible state.
 */

function activateInitialMotion() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
        if (!initializedElements.has(element)) {
          return;
        }

        const visibleNow = isInViewport(element);

        if (visibleNow) {
          showMotionElement(element);
        }

        /* Below-the-fold elements, and repeat elements, keep observing. */

        if (!visibleNow || !shouldRunOnce(element)) {
          getObserver(element).observe(element);
        }
      });
    });
  });
}

/* ==========================================================================
   Reveal Everything (reduced motion / late load)
   ========================================================================== */

function revealAll() {
  document.querySelectorAll(MOTION_SELECTOR).forEach((element) => {
    if (!initializedElements.has(element)) {
      return;
    }

    const type = getMotionType(element);

    if (type === "type") {
      finishTyping(element);

      return;
    }

    if (type === "placeholder") {
      finishPlaceholder(element);

      return;
    }

    clearStartTimer(element);

    clearCompletionTimer(element);

    showAllUnits(element);

    element.classList.add("is-motion-visible", "is-motion-complete");
  });
}

function handleMotionPreferenceChange() {
  if (prefersReducedMotion()) {
    revealAll();
  }
}

/* ==========================================================================
   Public Refresh
   ========================================================================== */

/**
 * Initialize Motion markup inserted after page load.
 * Called automatically for DOM changes; exported for manual use.
 *
 * @param {Document | DocumentFragment | HTMLElement} scope
 */

export function refreshMotion(scope = document) {
  initializeGroups(scope);

  initializeMotionElements(scope, { observe: true });

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
 * Only nodes that contain Motion markup are processed. This skips the spans
 * Motion creates itself when preparing text.
 */

function containsMotion(node) {
  return (
    node.matches(ANY_MOTION_SELECTOR) ||
    node.querySelector(ANY_MOTION_SELECTOR) !== null
  );
}

function handleMutations(mutations) {
  const groupsToRefresh = new Set();

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!isElement(node) || !containsMotion(node)) {
        return;
      }

      initializeGroups(node);

      initializeMotionElements(node, { observe: true });

      const owningGroup = node.closest(GROUP_SELECTOR);

      if (owningGroup) {
        groupsToRefresh.add(owningGroup);
      }

      node.querySelectorAll(GROUP_SELECTOR).forEach((group) => {
        groupsToRefresh.add(group);
      });
    });
  });

  groupsToRefresh.forEach(refreshGroup);
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

  /* JavaScript arrived: cancel the <head> safety timer. */

  window.clearTimeout(window.__motionFallback);

  motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Group timing first; text unit timing reads the resolved delays. */

  initializeGroups(document);

  /* Prepare without observing, so nothing reveals before the first paint. */

  initializeMotionElements(document, { observe: false });

  /*
   * If the safety timer already fired, the visitor has been reading the
   * page. Never hide content they can already see — just finish everything.
   */

  if (window.__motionFallbackFired) {
    revealAll();

    return;
  }

  root.classList.add("motion-ready");

  if (prefersReducedMotion()) {
    revealAll();
  } else {
    whenPageReady().then(activateInitialMotion);
  }

  if (document.body) {
    mutationObserver = new MutationObserver(handleMutations);

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /* React live to both the OS setting and the site's own setting. */

  motionMediaQuery.addEventListener?.("change", handleMotionPreferenceChange);

  /* Looping placeholders stop completely while the tab is hidden. */

  document.addEventListener("visibilitychange", handleVisibilityChange);

  preferenceObserver = new MutationObserver(handleMotionPreferenceChange);

  preferenceObserver.observe(root, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
}

/* ==========================================================================
   Auto Start
   ========================================================================== */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMotion, { once: true });
} else {
  initMotion();
}
